const { randomBytes } = require('crypto');
const { put, del } = require('@vercel/blob');
const { send, readJson, cleanText } = require('../lib/http');
const { getSql } = require('../lib/db');
const { requireOwner } = require('./auth');
const {
  FONT_OPTIONS,
  THEME_PRESETS,
  defaultSettings,
  mergeSettings,
  fontPair,
  applyPresetToTheme,
  ensureSiteSchema,
  getPublicSettings,
  saveSettings,
  loadSettingsRow,
  resetTheme,
  listGallery
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
    try { await del(url); } catch (error) { /* file may be gone */ }
  }
}

function cleanColor(value, fallback) {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  return fallback;
}

function cleanUrl(value, max) {
  const text = cleanText(value, max || 500, { allowEmpty: true });
  if (text == null) return '';
  if (!text) return '';
  if (/^\/[^\s]*$/.test(text)) return text;
  if (/^https:\/\//i.test(text)) return text;
  return null;
}

function cleanBool(value) {
  return Boolean(value);
}

function sanitizeSettings(body) {
  const current = defaultSettings();
  const partial = {};
  if (body.theme && typeof body.theme === 'object') {
    const theme = body.theme;
    if (theme.preset && THEME_PRESETS[theme.preset] && !theme.primary && !theme.accent) {
      partial.theme = applyPresetToTheme({ preset: theme.preset }, theme.preset);
    } else {
      const base = mergeSettings({ theme: theme }).theme;
      partial.theme = {};
      if (Object.prototype.hasOwnProperty.call(theme, 'preset')) {
        partial.theme.preset = cleanText(theme.preset, 40) || base.preset;
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'primary')) {
        partial.theme.primary = cleanColor(theme.primary, base.primary);
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'primaryDark')) {
        partial.theme.primaryDark = cleanColor(theme.primaryDark, base.primaryDark);
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'accent')) {
        partial.theme.accent = cleanColor(theme.accent, base.accent);
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'background')) {
        partial.theme.background = cleanColor(theme.background, base.background);
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'text')) {
        partial.theme.text = cleanColor(theme.text, base.text);
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'fontId')) {
        partial.theme.fontId = FONT_OPTIONS.some(function (f) { return f.id === theme.fontId; }) ? theme.fontId : base.fontId;
      }
      if (Object.prototype.hasOwnProperty.call(theme, 'logoUrl')) {
        partial.theme.logoUrl = cleanUrl(theme.logoUrl, 500) != null ? (cleanUrl(theme.logoUrl, 500) || base.logoUrl) : base.logoUrl;
      }
      if (theme.preset && THEME_PRESETS[theme.preset] && partial.theme.preset && !partial.theme.primary) {
        partial.theme = applyPresetToTheme(Object.assign({}, base, partial.theme), theme.preset);
      }
    }
  }
  if (body.homepage && typeof body.homepage === 'object') {
    const hp = body.homepage;
    partial.homepage = {};
    if (Object.prototype.hasOwnProperty.call(hp, 'heroBadge')) {
      partial.homepage.heroBadge = cleanText(hp.heroBadge, 120) || current.homepage.heroBadge;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'heroHeadline')) {
      partial.homepage.heroHeadline = cleanText(hp.heroHeadline, 200, { keepLines: true }) || current.homepage.heroHeadline;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'heroSubtext')) {
      partial.homepage.heroSubtext = cleanText(hp.heroSubtext, 800, { keepLines: true }) || current.homepage.heroSubtext;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'heroImage')) {
      partial.homepage.heroImage = cleanUrl(hp.heroImage, 500) != null
        ? (cleanUrl(hp.heroImage, 500) || current.homepage.heroImage)
        : current.homepage.heroImage;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'heroBadgeNote')) {
      partial.homepage.heroBadgeNote = cleanText(hp.heroBadgeNote, 40) || current.homepage.heroBadgeNote;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'heroBadgeCaption')) {
      partial.homepage.heroBadgeCaption = cleanText(hp.heroBadgeCaption, 80) || current.homepage.heroBadgeCaption;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'aboutEyebrow')) {
      partial.homepage.aboutEyebrow = cleanText(hp.aboutEyebrow, 120) || current.homepage.aboutEyebrow;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'aboutTitle')) {
      partial.homepage.aboutTitle = cleanText(hp.aboutTitle, 120) || current.homepage.aboutTitle;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'aboutText')) {
      partial.homepage.aboutText = cleanText(hp.aboutText, 2000, { keepLines: true }) || current.homepage.aboutText;
    }
    if (Object.prototype.hasOwnProperty.call(hp, 'aboutImage')) {
      partial.homepage.aboutImage = cleanUrl(hp.aboutImage, 500) != null
        ? (cleanUrl(hp.aboutImage, 500) || current.homepage.aboutImage)
        : current.homepage.aboutImage;
    }
    if (Array.isArray(hp.processSteps)) {
      partial.homepage.processSteps = hp.processSteps.slice(0, 6).map(function (step) {
        return {
          title: cleanText(step && step.title, 80) || 'Step',
          text: cleanText(step && step.text, 400, { keepLines: true }) || ''
        };
      }).filter(function (step) { return step.title; });
    }
  }
  if (body.gallery && typeof body.gallery === 'object') {
    partial.gallery = {
      title: cleanText(body.gallery.title, 120) || current.gallery.title,
      subtitle: cleanText(body.gallery.subtitle, 400, { keepLines: true }) || current.gallery.subtitle
    };
  }
  if (body.impact && typeof body.impact === 'object') {
    const impact = body.impact;
    partial.impact = {
      title: cleanText(impact.title, 120) || current.impact.title,
      bullets: Array.isArray(impact.bullets)
        ? impact.bullets.map(function (line) { return cleanText(line, 300); }).filter(Boolean).slice(0, 12)
        : undefined,
      stats: Array.isArray(impact.stats)
        ? impact.stats.slice(0, 8).map(function (stat) {
          return {
            value: cleanText(stat && stat.value, 40) || '',
            label: cleanText(stat && stat.label, 80) || ''
          };
        }).filter(function (stat) { return stat.value && stat.label; })
        : undefined
    };
  }
  if (body.contact && typeof body.contact === 'object') {
    const c = body.contact;
    const whatsapp = String(c.whatsapp || '').replace(/\D/g, '').slice(0, 20);
    partial.contact = {
      whatsapp: whatsapp || current.contact.whatsapp,
      facebook: cleanUrl(c.facebook, 500) != null ? (cleanUrl(c.facebook, 500) || '') : current.contact.facebook,
      instagram: cleanUrl(c.instagram, 500) != null ? (cleanUrl(c.instagram, 500) || '') : current.contact.instagram,
      tiktok: cleanUrl(c.tiktok, 500) != null ? (cleanUrl(c.tiktok, 500) || '') : current.contact.tiktok,
      youtube: cleanUrl(c.youtube, 500) != null ? (cleanUrl(c.youtube, 500) || '') : current.contact.youtube,
      email: cleanText(c.email, 120, { allowEmpty: true }) != null ? cleanText(c.email, 120, { allowEmpty: true }) : current.contact.email,
      hours: cleanText(c.hours, 200, { keepLines: true, allowEmpty: true }) != null
        ? cleanText(c.hours, 200, { keepLines: true, allowEmpty: true })
        : current.contact.hours,
      contactTitle: cleanText(c.contactTitle, 120) || current.contact.contactTitle,
      contactLead: cleanText(c.contactLead, 500, { keepLines: true }) || current.contact.contactLead
    };
  }
  if (body.banner && typeof body.banner === 'object') {
    partial.banner = {
      enabled: cleanBool(body.banner.enabled),
      text: cleanText(body.banner.text, 200, { allowEmpty: true }) != null
        ? cleanText(body.banner.text, 200, { allowEmpty: true })
        : '',
      link: cleanUrl(body.banner.link, 500) != null ? (cleanUrl(body.banner.link, 500) || '') : ''
    };
  }
  function cleanRecord(obj, spec, current) {
    var out = {};
    Object.keys(spec).forEach(function (field) {
      var rule = spec[field];
      if (Object.prototype.hasOwnProperty.call(obj, field)) {
        if (rule.type === 'text') {
          out[field] = cleanText(obj[field], rule.max || 500, rule.opts || {}) || (current && current[field]) || '';
        } else if (rule.type === 'map') {
          out[field] = Object.assign({}, current && current[field], obj[field] || {});
        } else if (rule.type === 'features') {
          out[field] = Array.isArray(obj[field]) ? obj[field].slice(0, 6).map(function (item) {
            return {
              title: cleanText(item && item.title, 120) || '',
              text: cleanText(item && item.text, 600, { keepLines: true }) || ''
            };
          }) : (current && current[field]);
        }
      }
    });
    return out;
  }

  if (body.shop && typeof body.shop === 'object') {
    partial.shop = cleanRecord(body.shop, {
      title: { type: 'text', max: 120 },
      lead: { type: 'text', max: 800, opts: { keepLines: true } },
      demoNote: { type: 'text', max: 400 },
      invalidCategoryTitle: { type: 'text', max: 80 },
      invalidCategoryLead: { type: 'text', max: 400 },
      categoryBlurbs: { type: 'map' },
      categoryTitles: { type: 'map' }
    }, current.shop);
  }
  if (body.aboutPage && typeof body.aboutPage === 'object') {
    partial.aboutPage = cleanRecord(body.aboutPage, {
      features: { type: 'features' },
      plantImage: { type: 'text', max: 500 },
      plantCaption: { type: 'text', max: 300 }
    }, current.aboutPage);
  }
  if (body.processPage && typeof body.processPage === 'object') {
    partial.processPage = { title: cleanText(body.processPage.title, 120) || current.processPage.title };
  }
  ['consultation', 'cartPage', 'footer', 'nav', 'chrome'].forEach(function (section) {
    if (body[section] && typeof body[section] === 'object') {
      partial[section] = {};
      Object.keys(body[section]).forEach(function (key) {
        partial[section][key] = cleanText(body[section][key], 800, { keepLines: true, allowEmpty: true }) != null
          ? cleanText(body[section][key], 800, { keepLines: true, allowEmpty: true })
          : (current[section] && current[section][key]) || '';
      });
    }
  });

  if (body.visibility && typeof body.visibility === 'object') {
    const v = body.visibility;
    partial.visibility = {
      hero: v.hero !== false,
      about: v.about !== false,
      gallery: v.gallery !== false,
      products: v.products !== false,
      process: v.process !== false,
      impact: v.impact !== false,
      contact: v.contact !== false,
      consultation: v.consultation !== false
    };
  }
  return partial;
}

module.exports = async function handler(req, res) {
  try {
    if (!(await requireOwner(req, res))) return;
    await ensureSiteSchema();

    if (req.method === 'GET') {
      const payload = await getPublicSettings();
      payload.meta = { fonts: FONT_OPTIONS, presets: Object.values(THEME_PRESETS) };
      return send(res, 200, payload);
    }

    const sql = getSql();
    const body = await readJson(req);

    if (req.method === 'POST' && body.action === 'reset-theme') {
      const theme = await resetTheme();
      return send(res, 200, { settings: mergeSettings({ theme: theme }), theme: theme });
    }

    if (req.method === 'POST' && body.action === 'logo') {
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That image is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'Photo storage is not connected yet.' });
      const current = await loadSettingsRow();
      if (current.theme.logoUrl && /^https:\/\//.test(current.theme.logoUrl)) await removeBlob(current.theme.logoUrl);
      const blob = await put('site/logo-' + newId() + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const settings = await saveSettings({ theme: Object.assign({}, current.theme, { logoUrl: blob.url }) });
      return send(res, 200, { settings: settings });
    }

    if (req.method === 'POST' && body.action === 'hero-image') {
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That photo is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'Photo storage is not connected yet.' });
      const current = await loadSettingsRow();
      const blob = await put('site/hero-' + newId() + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const settings = await saveSettings({ homepage: Object.assign({}, current.homepage, { heroImage: blob.url }) });
      return send(res, 200, { settings: settings });
    }

    if (req.method === 'POST' && body.action === 'about-image') {
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That photo is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'Photo storage is not connected yet.' });
      const current = await loadSettingsRow();
      const blob = await put('site/about-' + newId() + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const settings = await saveSettings({ homepage: Object.assign({}, current.homepage, { aboutImage: blob.url }) });
      return send(res, 200, { settings: settings });
    }

    if (req.method === 'POST' && body.action === 'about-plant-image') {
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That photo is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'Photo storage is not connected yet.' });
      const current = await loadSettingsRow();
      const blob = await put('site/about-plant-' + newId() + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const settings = await saveSettings({
        aboutPage: Object.assign({}, current.aboutPage || {}, { plantImage: blob.url })
      });
      return send(res, 200, { settings: settings });
    }

    if (req.method === 'POST' && body.action === 'gallery-photo') {
      const buffer = photoBuffer(body.data);
      if (!buffer) return send(res, 400, { error: 'That photo is too large. Try another one.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'Photo storage is not connected yet.' });
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
      return send(res, 200, { gallery: await listGallery(), settings: await loadSettingsRow() });
    }

    if (req.method === 'POST' && body.action === 'gallery-caption') {
      const id = cleanText(body.id, 80);
      const caption = cleanText(body.caption, 200, { allowEmpty: true });
      if (caption == null) return send(res, 400, { error: 'Caption is too long.' });
      await sql`UPDATE gallery_photos SET caption = ${caption || ''} WHERE id = ${id}`;
      return send(res, 200, { gallery: await listGallery() });
    }

    if (req.method === 'POST' && body.action === 'gallery-reorder') {
      const ids = Array.isArray(body.ids) ? body.ids.map(function (id) { return cleanText(id, 80); }).filter(Boolean) : [];
      for (let i = 0; i < ids.length; i++) {
        await sql`UPDATE gallery_photos SET sort_order = ${i} WHERE id = ${ids[i]}`;
      }
      return send(res, 200, { gallery: await listGallery() });
    }

    if (req.method === 'POST' && body.action === 'gallery-delete') {
      const id = cleanText(body.id, 80);
      const rows = await sql`SELECT url FROM gallery_photos WHERE id = ${id}`;
      if (rows.length) await removeBlob(rows[0].url);
      await sql`DELETE FROM gallery_photos WHERE id = ${id}`;
      return send(res, 200, { gallery: await listGallery() });
    }

    if (req.method === 'PATCH') {
      const partial = sanitizeSettings(body);
      const settings = await saveSettings(partial);
      return send(res, 200, { settings: settings, gallery: await listGallery() });
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
