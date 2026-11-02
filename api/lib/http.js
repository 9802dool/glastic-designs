function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function slugify(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'product';
}

function cleanPrice(value) {
  const price = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(price) || price < 0 || price > 1000000) return null;
  return price;
}

function cleanText(value, max, options) {
  const opts = options || {};
  let text = String(value == null ? '' : value).replace(/\r\n/g, '\n').trim();
  if (opts.keepLines) text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  else text = text.replace(/\s+/g, ' ').trim();
  if (text.length > max) return null;
  if (!text && !opts.allowEmpty) return null;
  return text;
}

module.exports = { send, readJson, slugify, cleanPrice, cleanText };
