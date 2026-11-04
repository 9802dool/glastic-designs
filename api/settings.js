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
      const { defaultSettings, DEFAULT_GALLERY } = require('./lib/site-settings');
      return send(res, 200, {
        settings: defaultSettings(),
        gallery: DEFAULT_GALLERY.map(function (item, index) {
          return { id: item.id, url: item.url, caption: item.caption, sortOrder: index };
        }),
        offline: true
      });
    }
    return send(res, 500, { error: 'Could not load site settings' });
  }
};
