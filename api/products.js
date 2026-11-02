const { send } = require('./lib/http');
const { listProducts } = require('./lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const products = await listProducts(false);
    return send(res, 200, { products: products });
  } catch (error) {
    if (error && error.code === 'database-missing') {
      return send(res, 503, { error: 'database-missing', products: [] });
    }
    return send(res, 500, { error: 'Could not load products' });
  }
};
