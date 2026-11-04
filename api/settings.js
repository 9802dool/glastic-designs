const { send } = require('./lib/http');
const { getPublicSettings } = require('./lib/site-settings');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const payload = await getPublicSettings();
    return send(res, 200, payload);
  } catch (error) {
    if (error && error.code === 'database-missing') {
      return send(res, 200, {
        pages_v2: {},
        pages_v2_meta: { galleryLive: false, savedPages: {} },
        gallery: null,
        offline: true
      });
    }
    return send(res, 500, { error: 'Could not load site settings' });
  }
};
