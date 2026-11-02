const { randomBytes } = require('crypto');
const { put, del } = require('@vercel/blob');
const { send, readJson, slugify, cleanPrice, cleanText } = require('../lib/http');
const { getSql, ensureSchema, listProducts } = require('../lib/db');
const { requireOwner } = require('./auth');

function newId() {
  return randomBytes(8).toString('hex');
}

async function deleteProduct(sql, id, res) {
  const photos = await sql`SELECT url FROM product_photos WHERE product_id = ${id}`;
  for (let i = 0; i < photos.length; i++) {
    if (/^https:\/\//.test(photos[i].url)) {
      try { await del(photos[i].url); } catch (error) { /* ignore missing files */ }
    }
  }
  await sql`DELETE FROM products WHERE id = ${id}`;
  return send(res, 200, { products: await listProducts(true) });
}

module.exports = async function handler(req, res) {
  try {
    if (!(await requireOwner(req, res))) return;
    await ensureSchema();
    const sql = getSql();

    if (req.method === 'GET') {
      return send(res, 200, { products: await listProducts(true) });
    }

    const body = await readJson(req);

    if (req.method === 'POST' && body.action === 'reorder') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      for (let i = 0; i < ids.length; i++) {
        await sql`UPDATE products SET sort_order = ${i}, updated_at = now() WHERE id = ${ids[i]}`;
      }
      return send(res, 200, { products: await listProducts(true) });
    }

    if (req.method === 'POST' && body.action === 'photo') {
      const productId = cleanText(body.productId, 80);
      const data = String(body.data || '');
      const found = await sql`SELECT id FROM products WHERE id = ${productId}`;
      if (!found.length) return send(res, 404, { error: 'Product not found.' });
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return send(res, 503, { error: 'Photo storage is not connected yet.' });
      }
      const buffer = Buffer.from(data, 'base64');
      if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
        return send(res, 400, { error: 'That photo is too large. Try another one.' });
      }
      const photoId = newId();
      const blob = await put('products/' + productId + '/' + photoId + '.jpg', buffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false
      });
      const existing = await sql`SELECT id FROM product_photos WHERE product_id = ${productId}`;
      const isMain = body.makeMain === true || existing.length === 0;
      if (isMain) await sql`UPDATE product_photos SET is_main = false WHERE product_id = ${productId}`;
      await sql`
        INSERT INTO product_photos (id, product_id, url, is_main, sort_order)
        VALUES (${photoId}, ${productId}, ${blob.url}, ${isMain}, ${existing.length})`;
      return send(res, 200, { products: await listProducts(true) });
    }

    if (req.method === 'POST' && body.action === 'main-photo') {
      const productId = cleanText(body.productId, 80);
      const photoId = cleanText(body.photoId, 80);
      await sql`UPDATE product_photos SET is_main = false WHERE product_id = ${productId}`;
      await sql`UPDATE product_photos SET is_main = true WHERE id = ${photoId} AND product_id = ${productId}`;
      return send(res, 200, { products: await listProducts(true) });
    }

    if (req.method === 'POST' && body.action === 'delete') {
      return deleteProduct(sql, cleanText(body.id, 80), res);
    }

    if (req.method === 'POST' && body.action === 'visibility') {
      const id = cleanText(body.id, 80);
      await sql`UPDATE products SET hidden = ${Boolean(body.hidden)}, updated_at = now() WHERE id = ${id}`;
      return send(res, 200, { products: await listProducts(true) });
    }

    if (req.method === 'POST' && body.action === 'delete-photo') {
      const photoId = cleanText(body.photoId, 80);
      const rows = await sql`SELECT url, product_id FROM product_photos WHERE id = ${photoId}`;
      if (rows.length && /^https:\/\//.test(rows[0].url)) {
        try { await del(rows[0].url); } catch (error) { /* keep going if the file is already gone */ }
      }
      await sql`DELETE FROM product_photos WHERE id = ${photoId}`;
      if (rows.length) {
        const left = await sql`SELECT id FROM product_photos WHERE product_id = ${rows[0].product_id} ORDER BY sort_order LIMIT 1`;
        if (left.length) await sql`UPDATE product_photos SET is_main = true WHERE id = ${left[0].id}`;
      }
      return send(res, 200, { products: await listProducts(true) });
    }

    if (req.method === 'POST') {
      const name = cleanText(body.name, 80);
      const description = cleanText(body.description, 2000, { keepLines: true, allowEmpty: true });
      const category = cleanText(body.category, 40) || 'General';
      const price = cleanPrice(body.priceTtd);
      if (!name || description == null || price == null) return send(res, 400, { error: 'Add a name and a price in TTD.' });
      let id = slugify(name);
      const clash = await sql`SELECT id FROM products WHERE id = ${id}`;
      if (clash.length) id = id + '-' + newId().slice(0, 4);
      const order = await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS max FROM products`;
      await sql`
        INSERT INTO products (id, name, description, category, price_ttd, sort_order, hidden)
        VALUES (${id}, ${name}, ${description}, ${category}, ${price}, ${order[0].max + 1}, false)`;
      return send(res, 200, { products: await listProducts(true), id: id });
    }

    if (req.method === 'PATCH') {
      const id = cleanText(body.id, 80);
      const current = await sql`SELECT id FROM products WHERE id = ${id}`;
      if (!current.length) return send(res, 404, { error: 'Product not found.' });
      const name = cleanText(body.name, 80);
      const description = cleanText(body.description, 2000, { keepLines: true, allowEmpty: true });
      const category = cleanText(body.category, 40) || 'General';
      const price = cleanPrice(body.priceTtd);
      if (!name || description == null || price == null) return send(res, 400, { error: 'Add a name and a price in TTD.' });
      const hidden = Boolean(body.hidden);
      await sql`
        UPDATE products
        SET name = ${name}, description = ${description}, category = ${category},
            price_ttd = ${price}, hidden = ${hidden}, updated_at = now()
        WHERE id = ${id}`;
      return send(res, 200, { products: await listProducts(true) });
    }

    if (req.method === 'DELETE') {
      return deleteProduct(sql, cleanText(body.id, 80), res);
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error && error.code === 'database-missing') {
      return send(res, 503, { error: 'database-missing', needsDatabase: true });
    }
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
};
