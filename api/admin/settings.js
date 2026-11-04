const { randomBytes } = require('crypto');
const { put, del } = require('@vercel/blob');
const { send, readJson, cleanText } = require('../lib/http');
const { getSql } = require('../lib/db');
const { requireOwner } = require('./auth');
const {
  defaultPagesV2,
  ensureSiteSchema,
  getAdminSettingsPayload,
  savePagesV2,
  patchPagesV2Meta,
  listGallery,
  pageFieldSpecs,
  legacyTextDiffs,
  pickLegacy,
  loadRawRow
} = require('../lib/site-settings');

function newId() {
  return randomBytes(8).toString('hex');
}

function photoBuffer(data) {
  const buffer = Buffer.from(String(data || ''), 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) return null;
  return buffer;
}

async function removeBlob(url) {
  if (url && /^https:\/\//.test(url)) {
    try { await del(url); } catch (error) { /* ignore */ }
  }
}

function cleanUrl(value) {
  const text = cleanText(value, 500, { allowEmpty: true });
  if (text == null) return null;
  if (!text) return '';
  if (/^\/[^\s]*$/.test(text)) return text;
  if (/^https:\/\//i.test(text)) return text;
  return null;
}

function sanitizePage(pageId, body) {
  const specs = pageFieldSpecs()[pageId];
  const defaults = defaultPagesV2()[pageId] || {};
  if (!specs || !body || typeof body !== 'object') return null;
  const out = Object.assign({}, defaults);
  Object.keys(specs).forEach(function (field) {
    const rule = specs[field];
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;
    if (rule === 'map') {
      const current = out[field] || {};
      const patch = body[field];
      if (patch && typeof patch === 'object') {
        out[field] = Object.assign({}, current);
        Object.keys(current).forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(patch, key)) {
            const val = cleanText(patch[key], 400, { keepLines: true, allowEmpty: true });
            if (val != null) out[field][key] = val || current[key];
          }
        });
      }
      return;
    }
    if (rule === 'url') {
      const url = cleanUrl(body[field]);
      if (url != null) out[field] = url || defaults[field];
      return;
    }
    const val = cleanText(body[field], rule, { keepLines: true, allowEmpty: field.indexOf('Label') >= 0 });
    if (val != null) out[field] = val || defaults[field];
  });
  return out;
}

module.exports = async function handler(req, res) {
  try {
    if (!(await requireOwner(req, res))) return;
    await ensureSiteSchema();
    const sql = getSql();
    const body = await readJson(req);

    if (req.method === 'GET') {
      const payload = await getAdminSettingsPayload();
      payload.legacyDiffs = legacyTextDiffs(pickLegacy(await loadRawRow()));
      return send(res, 200, payload);
    }

    if (req.method === 'PATCH') {
      const pageId = cleanText(body.pageId, 40);
      if (!pageId || !pageFieldSpecs()[pageId]) {
        return send(res, 400, { error: 'Choose a valid page to save.' });
      }
      const pageData = sanitizePage(pageId, body.page || body);
      if (!pageData) return send(res, 400, { error: 'Nothing to save.' });
      await savePagesV2(pageId, pageData, { markPageSaved: true });
      const payload = await getAdminSettingsPayload();
      return send(res, 200, payload);
    }

    if (req.method === 'POST' && body.action === 'page-image') {
      const pageId = cleanText(body.pageId, 40);
      const field = cleanText(body.field, 40);
      const specs = pageFieldSpecs()[pageId] || {};
      if (!pageId || !field || specs[field] !== 'url') {
        return send(res, 400, { error: 'Invalid photo target.' });
      }
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That photo is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return send(res, 503, { error: 'Photo storage is not connected yet.' });
      }
      const blob = await put('pages/' + pageId + '-' + field + '-' + newId() + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const raw = await loadRawRow();
      const saved = Object.assign({}, defaultPagesV2()[pageId], (raw.pages_v2 && raw.pages_v2[pageId]) || {});
      saved[field] = blob.url;
      await savePagesV2(pageId, saved, { markPageSaved: true });
      const payload = await getAdminSettingsPayload();
      return send(res, 200, payload);
    }

    if (req.method === 'POST' && body.action === 'gallery-photo') {
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That photo is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return send(res, 503, { error: 'Photo storage is not connected yet.' });
      }
      const photoId = newId();
      const blob = await put('gallery/' + photoId + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const order = await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS max FROM gallery_photos`;
      const caption = cleanText(body.caption, 200, { allowEmpty: true }) || '';
      await sql`
        INSERT INTO gallery_photos (id, url, caption, sort_order)
        VALUES (${photoId}, ${blob.url}, ${caption}, ${order[0].max + 1})`;
      await patchPagesV2Meta({ galleryLive: true });
      const payload = await getAdminSettingsPayload();
      return send(res, 200, payload);
    }

    if (req.method === 'POST' && body.action === 'gallery-caption') {
      const id = cleanText(body.id, 80);
      const caption = cleanText(body.caption, 200, { allowEmpty: true });
      if (caption == null) return send(res, 400, { error: 'Caption is too long.' });
      await sql`UPDATE gallery_photos SET caption = ${caption || ''} WHERE id = ${id}`;
      await patchPagesV2Meta({ galleryLive: true });
      const payload = await getAdminSettingsPayload();
      return send(res, 200, payload);
    }

    if (req.method === 'POST' && body.action === 'gallery-reorder') {
      const ids = Array.isArray(body.ids) ? body.ids.map(function (id) { return cleanText(id, 80); }).filter(Boolean) : [];
      for (let i = 0; i < ids.length; i++) {
        await sql`UPDATE gallery_photos SET sort_order = ${i} WHERE id = ${ids[i]}`;
      }
      await patchPagesV2Meta({ galleryLive: true });
      const payload = await getAdminSettingsPayload();
      return send(res, 200, payload);
    }

    if (req.method === 'POST' && body.action === 'gallery-delete') {
      const id = cleanText(body.id, 80);
      const rows = await sql`SELECT url FROM gallery_photos WHERE id = ${id}`;
      if (rows.length) await removeBlob(rows[0].url);
      await sql`DELETE FROM gallery_photos WHERE id = ${id}`;
      await patchPagesV2Meta({ galleryLive: true });
      const payload = await getAdminSettingsPayload();
      return send(res, 200, payload);
    }

    res.setHeader('Allow', 'GET, PATCH, POST');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error && error.code === 'database-missing') {
      return send(res, 503, { error: 'database-missing', needsDatabase: true });
    }
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
};
