#!/usr/bin/env node
const {
  pickLegacy,
  legacyTextDiffs,
  loadRawRow,
  ensureSiteSchema,
  defaultPagesV2
} = require('../api/lib/site-settings');

async function main() {
  await ensureSiteSchema();
  const raw = await loadRawRow();
  const legacy = pickLegacy(raw);
  const diffs = legacyTextDiffs(legacy);
  if (legacy.homepage) {
    const home = defaultPagesV2().home;
    Object.keys(legacy.homepage).forEach(function (key) {
      const val = legacy.homepage[key];
      if (!val || typeof val !== 'string') return;
      const map = { aboutTitle: 'title', aboutText: 'text', heroHeadline: 'heroHeadline', heroSubtext: 'heroSubtext' };
      const defKey = map[key] || key;
      const defVal = home[defKey] || (key === 'aboutTitle' ? home.title : null);
      if (defVal && val !== defVal) {
        diffs.push({ legacy: 'homepage.' + key, value: val.slice(0, 120) });
      }
    });
  }
  console.log(JSON.stringify({
    legacyDiffs: diffs,
    pages_v2_saved: raw.pages_v2_meta && raw.pages_v2_meta.savedPages,
    galleryLive: raw.pages_v2_meta && raw.pages_v2_meta.galleryLive
  }, null, 2));
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
