const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');
const { getSql, ensureSchema } = require('./db');

const SETTINGS_ID = 1;

const FONT_OPTIONS = [
  { id: 'playfair-inter', label: 'Classic (Playfair + Inter)', display: 'Playfair Display', body: 'Inter' },
  { id: 'fraunces-inter', label: 'Warm (Fraunces + Inter)', display: 'Fraunces', body: 'Inter' },
  { id: 'lora-inter', label: 'Friendly (Lora + Inter)', display: 'Lora', body: 'Inter' },
  { id: 'dm-serif-inter', label: 'Modern (DM Serif + Inter)', display: 'DM Serif Display', body: 'Inter' }
];

const THEME_PRESETS = {
  forest: {
    id: 'forest',
    label: 'Forest green',
    primary: '#065f46',
    primaryDark: '#064e3b',
    accent: '#0f766e',
    background: '#fafaf9',
    text: '#1c1917'
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean teal',
    primary: '#0e7490',
    primaryDark: '#155e75',
    accent: '#0891b2',
    background: '#f8fafc',
    text: '#0f172a'
  },
  sunset: {
    id: 'sunset',
    label: 'Warm sunset',
    primary: '#c2410c',
    primaryDark: '#9a3412',
    accent: '#ea580c',
    background: '#fffbeb',
    text: '#292524'
  },
  slate: {
    id: 'slate',
    label: 'Slate & sage',
    primary: '#475569',
    primaryDark: '#334155',
    accent: '#059669',
    background: '#f1f5f9',
    text: '#0f172a'
  }
};

const DEFAULT_PROCESS_STEPS = [
  { title: 'Collect', text: 'We collect plastic waste at events, from partners and communities across Trinidad and Tobago.' },
  { title: 'Sort & Shred', text: 'Plastics are sorted by type and color, then shredded for consistent material quality.' },
  { title: 'Process', text: 'Using Precious Plastic techniques, we melt and form the plastic into sheets, tiles and components.' },
  { title: 'Create', text: 'Crafted into durable, beautiful products ready for homes, schools and businesses.' }
];

const DEFAULT_IMPACT_BULLETS = [
  'Collected tens of kilograms at events (e.g. 33 lbs at Honeyfest, 60kg with partners)',
  'Partnered with NGC and others supporting local recycling efforts',
  'Changing the cultural perspective: plastic is a resource, not trash',
  'Supporting Every Bottle Back TT and circular economy initiatives'
];

const DEFAULT_IMPACT_STATS = [
  { value: '100%', label: 'Plastic Waste Products' },
  { value: '$250', label: 'TT Benches' },
  { value: '0.25kg', label: 'Recycled per Tile' },
  { value: 'T&T', label: 'Proudly Local' }
];

const DEFAULT_GALLERY = [
  { id: 'living-wall', url: '/images/living-wall.jpg', caption: 'Outdoor living wall' },
  { id: 'fern-planter', url: '/images/fern-planter.jpg', caption: 'Indoor vertical planter' },
  { id: 'front-door-garden', url: '/images/front-door-garden.jpg', caption: 'Front-door garden' },
  { id: 'triangle-planter', url: '/images/triangle-planter.jpg', caption: 'Triangle wall planter' },
  { id: 'planter-frames', url: '/images/planter-frames.jpg', caption: 'Planter frames in the workshop' }
];

function defaultSettings() {
  const preset = THEME_PRESETS.forest;
  return {
    theme: {
      preset: preset.id,
      primary: preset.primary,
      primaryDark: preset.primaryDark,
      accent: preset.accent,
      background: preset.background,
      text: preset.text,
      fontId: 'playfair-inter',
      logoUrl: '/logo.jpg'
    },
    homepage: {
      heroBadge: 'Made in Trinidad & Tobago ♻️',
      heroHeadline: 'Plastic Waste.\nBeautiful Design.',
      heroSubtext: 'We transform discarded plastic into durable, stylish interior products — tiles, furniture, coasters and more. Creating a circular economy right here in Trinidad and Tobago.',
      heroImage: '/images/living-wall.jpg',
      heroBadgeNote: 'T&T',
      heroBadgeCaption: 'Living walls & planters',
      aboutEyebrow: "We are nature's Keepers",
      aboutTitle: 'From Waste to Wonder',
      aboutText: 'Founded by Alicia Barrie-George, Glastic Designs (a play on glass, plants and plastics) began with a vision to introduce green spaces into urban Trinidad. After recognizing the massive volume of plastic waste, we pivoted to upcycling — turning discarded materials into high-value interior products, including living walls and planters.',
      aboutImage: '/images/owner.jpg',
      processSteps: DEFAULT_PROCESS_STEPS.slice()
    },
    gallery: {
      title: "Nature's Keepers",
      subtitle: 'Living walls and planters from our work in Trinidad and Tobago.'
    },
    impact: {
      title: 'Making a Difference',
      bullets: DEFAULT_IMPACT_BULLETS.slice(),
      stats: DEFAULT_IMPACT_STATS.slice()
    },
    contact: {
      whatsapp: '18687752407',
      facebook: 'https://www.facebook.com/gdistyles',
      instagram: 'https://instagram.com/glasticdesigns',
      tiktok: 'https://www.tiktok.com/@glastic.designs',
      youtube: 'https://www.youtube.com/@GlasticDesigns',
      email: '',
      hours: '',
      contactTitle: 'Ready to Order or Partner?',
      contactLead: 'DM us on Facebook, WhatsApp, or follow our journey. Custom colors, sizes and bulk orders welcome.'
    },
    banner: {
      enabled: false,
      text: '',
      link: ''
    },
    visibility: {
      hero: true,
      about: true,
      gallery: true,
      products: true,
      process: true,
      impact: true,
      contact: true,
      consultation: true
    }
  };
}

function mergeSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  return {
    theme: Object.assign({}, base.theme, raw.theme || {}),
    homepage: Object.assign({}, base.homepage, raw.homepage || {}, {
      processSteps: Array.isArray(raw.homepage && raw.homepage.processSteps)
        ? raw.homepage.processSteps
        : base.homepage.processSteps
    }),
    gallery: Object.assign({}, base.gallery, raw.gallery || {}),
    impact: Object.assign({}, base.impact, raw.impact || {}, {
      bullets: Array.isArray(raw.impact && raw.impact.bullets) ? raw.impact.bullets : base.impact.bullets,
      stats: Array.isArray(raw.impact && raw.impact.stats) ? raw.impact.stats : base.impact.stats
    }),
    contact: Object.assign({}, base.contact, raw.contact || {}),
    banner: Object.assign({}, base.banner, raw.banner || {}),
    visibility: Object.assign({}, base.visibility, raw.visibility || {})
  };
}

function fontPair(fontId) {
  const found = FONT_OPTIONS.find(function (item) { return item.id === fontId; });
  return found || FONT_OPTIONS[0];
}

function applyPresetToTheme(theme, presetId) {
  const preset = THEME_PRESETS[presetId];
  if (!preset) return theme;
  return Object.assign({}, theme, {
    preset: preset.id,
    primary: preset.primary,
    primaryDark: preset.primaryDark,
    accent: preset.accent,
    background: preset.background,
    text: preset.text
  });
}

function mapGalleryRow(row) {
  return { id: row.id, url: row.url, caption: row.caption || '' };
}

async function ensureSiteSchema() {
  await ensureSchema();
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      id integer PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id text PRIMARY KEY,
      url text NOT NULL,
      caption text NOT NULL DEFAULT '',
      sort_order integer NOT NULL DEFAULT 0
    )`;
  const settingsRow = await sql`SELECT id FROM site_settings WHERE id = ${SETTINGS_ID}`;
  if (!settingsRow.length) {
    await sql`
      INSERT INTO site_settings (id, data)
      VALUES (${SETTINGS_ID}, ${JSON.stringify(defaultSettings())}::jsonb)`;
  }
  const galleryCount = await sql`SELECT count(*)::int AS count FROM gallery_photos`;
  if (galleryCount[0].count === 0) {
    for (let i = 0; i < DEFAULT_GALLERY.length; i++) {
      const item = DEFAULT_GALLERY[i];
      const url = await resolveSeedGalleryUrl(item);
      await sql`
        INSERT INTO gallery_photos (id, url, caption, sort_order)
        VALUES (${item.id}, ${url}, ${item.caption}, ${i})
        ON CONFLICT (id) DO NOTHING`;
    }
  }
}

async function resolveSeedGalleryUrl(item) {
  const fallback = item.url;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fallback;
  const filePath = path.join(process.cwd(), item.url.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const body = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1) || 'jpg';
    const blob = await put('gallery/' + item.id + '.' + ext, body, {
      access: 'public',
      contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg',
      addRandomSuffix: false,
      allowOverwrite: true
    });
    return blob.url;
  } catch (error) {
    return fallback;
  }
}

async function listGallery() {
  await ensureSiteSchema();
  const sql = getSql();
  const rows = await sql`SELECT id, url, caption, sort_order FROM gallery_photos ORDER BY sort_order, id`;
  return rows.map(mapGalleryRow);
}

async function loadSettingsRow() {
  await ensureSiteSchema();
  const sql = getSql();
  const rows = await sql`SELECT data FROM site_settings WHERE id = ${SETTINGS_ID}`;
  return mergeSettings(rows[0] ? rows[0].data : null);
}

async function getPublicSettings() {
  const settings = await loadSettingsRow();
  const gallery = await listGallery();
  return { settings: settings, gallery: gallery, fonts: FONT_OPTIONS, presets: Object.values(THEME_PRESETS) };
}

async function saveSettings(partial) {
  const current = await loadSettingsRow();
  const patch = partial || {};
  const next = mergeSettings({
    theme: Object.assign({}, current.theme, patch.theme || {}),
    homepage: Object.assign({}, current.homepage, patch.homepage || {}),
    gallery: Object.assign({}, current.gallery, patch.gallery || {}),
    impact: Object.assign({}, current.impact, patch.impact || {}),
    contact: Object.assign({}, current.contact, patch.contact || {}),
    banner: Object.assign({}, current.banner, patch.banner || {}),
    visibility: Object.assign({}, current.visibility, patch.visibility || {})
  });
  if (patch.homepage && Array.isArray(patch.homepage.processSteps)) {
    next.homepage.processSteps = patch.homepage.processSteps;
  }
  if (patch.impact && Array.isArray(patch.impact.bullets)) {
    next.impact.bullets = patch.impact.bullets;
  }
  if (patch.impact && Array.isArray(patch.impact.stats)) {
    next.impact.stats = patch.impact.stats;
  }
  const sql = getSql();
  await sql`
    UPDATE site_settings
    SET data = ${JSON.stringify(next)}::jsonb, updated_at = now()
    WHERE id = ${SETTINGS_ID}`;
  return next;
}

async function resetTheme() {
  const current = await loadSettingsRow();
  const fresh = defaultSettings();
  const next = Object.assign({}, current, { theme: fresh.theme });
  const sql = getSql();
  await sql`
    UPDATE site_settings
    SET data = ${JSON.stringify(next)}::jsonb, updated_at = now()
    WHERE id = ${SETTINGS_ID}`;
  return next.theme;
}

module.exports = {
  FONT_OPTIONS,
  THEME_PRESETS,
  DEFAULT_GALLERY,
  defaultSettings,
  mergeSettings,
  fontPair,
  applyPresetToTheme,
  ensureSiteSchema,
  listGallery,
  loadSettingsRow,
  getPublicSettings,
  saveSettings,
  resetTheme,
  mapGalleryRow
};
