const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');
const { getSql, ensureSchema } = require('./db');

const SETTINGS_ID = 1;

const DEFAULT_GALLERY = [
  { id: 'living-wall', url: '/images/living-wall.jpg', caption: 'Outdoor living wall' },
  { id: 'fern-planter', url: '/images/fern-planter.jpg', caption: 'Indoor vertical planter' },
  { id: 'front-door-garden', url: '/images/front-door-garden.jpg', caption: 'Front-door garden' },
  { id: 'triangle-planter', url: '/images/triangle-planter.jpg', caption: 'Triangle wall planter' },
  { id: 'planter-frames', url: '/images/planter-frames.jpg', caption: 'Planter frames in the workshop' }
];

function defaultPagesV2() {
  return {
    home: {
      heroBadge: 'Made in Trinidad & Tobago ♻️',
      heroHeadline: 'Plastic Waste.\nBeautiful Design.',
      heroSubtext: 'We transform discarded plastic into durable, stylish interior products — tiles, furniture, coasters and more. Creating a circular economy right here in Trinidad and Tobago.',
      heroImage: '/images/living-wall.jpg',
      heroBadgeNote: 'T&T',
      heroBadgeCaption: 'Living walls & planters',
      exploreLabel: 'Explore Products'
    },
    about: {
      eyebrow: "We are nature's Keepers",
      title: 'From Waste to Wonder',
      text: 'Founded by Alicia Barrie-George, Glastic Designs (a play on glass, plants and plastics) began with a vision to introduce green spaces into urban Trinidad. After recognizing the massive volume of plastic waste, we pivoted to upcycling — turning discarded materials into high-value interior products, including living walls and planters.',
      image: '/images/owner.jpg',
      feature0Title: 'Circular Economy',
      feature0Text: 'Every product gives plastic a second life, reducing landfill waste and pollution in our communities and oceans.',
      feature1Title: 'School Furniture',
      feature1Text: 'We refurbish discarded school furniture using recycled plastic, providing low-cost solutions and better learning environments.',
      feature2Title: 'Made in TNT',
      feature2Text: 'Proudly designed and manufactured in Trinidad and Tobago. Supporting local jobs and Caribbean entrepreneurship.',
      plantImage: '/images/plant-benefits.jpg',
      plantCaption: 'Plantastic benefits of indoor plants, from our Facebook page.'
    },
    gallery: {
      title: "Nature's Keepers",
      subtitle: 'Living walls and planters from our work in Trinidad and Tobago.'
    },
    shop: {
      title: 'Our Products',
      lead: 'Durable, waterproof, low-maintenance pieces crafted from 100% plastic waste. Custom colors and sizes available.',
      demoNote: 'Add pieces to your cart, then check out once. The payment step is a demo — nothing is charged.',
      categoryTitles: {
        Tiles: 'Tiles',
        Planters: 'Planters',
        Furniture: 'Furniture',
        Gifts: 'Gifts',
        Services: 'Services'
      },
      categoryBlurbs: {
        Tiles: 'Durable, waterproof wall and floor tiles made from plastic waste. Hexagonal, square, and rectangular shapes are available.',
        Planters: "Living walls and vertical planters. We are nature's Keepers, planting walls for homes and outdoors in Trinidad and Tobago.",
        Furniture: 'Benches, stools, shelves, consoles, and tables for indoors, outdoors, classrooms, and patios.',
        Gifts: 'Coasters, clocks, trophies, medals, and keychains made from upcycled plastic.',
        Services: 'Refurbished school desks and chairs, and design consultations with the studio.'
      }
    },
    process: {
      title: 'How We Make It',
      step0Title: 'Collect',
      step0Text: 'We collect plastic waste at events, from partners and communities across Trinidad and Tobago.',
      step1Title: 'Sort & Shred',
      step1Text: 'Plastics are sorted by type and color, then shredded for consistent material quality.',
      step2Title: 'Process',
      step2Text: 'Using Precious Plastic techniques, we melt and form the plastic into sheets, tiles and components.',
      step3Title: 'Create',
      step3Text: 'Crafted into durable, beautiful products ready for homes, schools and businesses.'
    },
    impact: {
      title: 'Making a Difference',
      bullet0: 'Collected tens of kilograms at events (e.g. 33 lbs at Honeyfest, 60kg with partners)',
      bullet1: 'Partnered with NGC and others supporting local recycling efforts',
      bullet2: 'Changing the cultural perspective: plastic is a resource, not trash',
      bullet3: 'Supporting Every Bottle Back TT and circular economy initiatives',
      stat0Value: '100%',
      stat0Label: 'Plastic Waste Products',
      stat1Value: '$250',
      stat1Label: 'TT Benches',
      stat2Value: '0.25kg',
      stat2Label: 'Recycled per Tile',
      stat3Value: 'T&T',
      stat3Label: 'Proudly Local'
    },
    contact: {
      title: 'Ready to Order or Partner?',
      lead: 'DM us on Facebook, WhatsApp, or follow our journey. Custom colors, sizes and bulk orders welcome.',
      consultEyebrow: 'Book a consultation',
      consultTitle: 'Port of Spain studio visit',
      consultLead: 'Reserve a design consultation and preview how paying online would work. The amount is a sample deposit in TTD.',
      consultDeposit: '$150.00 TTD',
      consultDepositLabel: 'Deposit',
      consultPayButton: 'Pay Deposit',
      consultWaButton: 'WhatsApp instead',
      consultNote: 'Demo — no real payment will be taken.',
      whatsappLabel: 'WhatsApp 775-2407',
      facebookLabel: 'Facebook Page'
    },
    cart: {
      title: 'Your cart',
      intro: 'Review the pieces you chose, then use one demo checkout. Nothing is charged.',
      emptyText: 'Your cart is empty. Add a piece from the shop, then come back here to check out.',
      subtotalLabel: 'Subtotal',
      checkoutButton: 'Checkout',
      checkoutNote: 'One demo checkout for this order. No real payment will be taken.',
      continueLabel: 'Continue shopping'
    },
    footer: {
      brand: 'Glastic Designs Interior Styles',
      tagline: 'Transforming plastic waste into beautiful, durable designs.',
      subline: 'Proudly Made in Trinidad & Tobago 🇹🇹 | Circular Economy | Support Local',
      copyright: '© 2026 Glastic Designs. All rights reserved. Content inspired by the official Facebook page.'
    }
  };
}

function defaultSettings() {
  return { pages_v2: null, _legacy: {} };
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

function mapGalleryRow(row) {
  return { id: row.id, url: row.url, caption: row.caption || '' };
}

async function listGallery() {
  await ensureSiteSchema();
  const sql = getSql();
  const rows = await sql`SELECT id, url, caption, sort_order FROM gallery_photos ORDER BY sort_order, id`;
  return rows.map(mapGalleryRow);
}

async function loadRawRow() {
  await ensureSiteSchema();
  const sql = getSql();
  const rows = await sql`SELECT data FROM site_settings WHERE id = ${SETTINGS_ID}`;
  return rows[0] ? rows[0].data : defaultSettings();
}

function getPagesV2Meta(raw) {
  const meta = (raw && raw.pages_v2_meta) || {};
  return {
    galleryLive: Boolean(meta.galleryLive),
    savedPages: meta.savedPages || {}
  };
}

function getSavedPagesV2(raw) {
  if (!raw || !raw.pages_v2 || typeof raw.pages_v2 !== 'object') return {};
  return raw.pages_v2;
}

async function getPublicSettings() {
  const raw = await loadRawRow();
  const meta = getPagesV2Meta(raw);
  const pages = getSavedPagesV2(raw);
  const gallery = await listGallery();
  return {
    pages_v2: pages,
    pages_v2_meta: meta,
    gallery: meta.galleryLive ? gallery : null
  };
}

async function getAdminSettingsPayload() {
  const raw = await loadRawRow();
  const meta = getPagesV2Meta(raw);
  const saved = getSavedPagesV2(raw);
  const defaults = defaultPagesV2();
  const gallery = await listGallery();
  return {
    defaults: defaults,
    pages_v2: saved,
    pages_v2_meta: meta,
    gallery: gallery,
    legacy: pickLegacy(raw)
  };
}

function pickLegacy(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    theme: raw.theme || null,
    homepage: raw.homepage || null,
    gallery: raw.gallery || null,
    impact: raw.impact || null,
    contact: raw.contact || null
  };
}

function legacyTextDiffs(legacy) {
  const defs = defaultPagesV2();
  const out = [];
  if (legacy.homepage) {
    ['heroHeadline', 'heroSubtext', 'aboutTitle', 'aboutText'].forEach(function (key) {
      if (legacy.homepage[key] && legacy.homepage[key] !== (defs.home && defs.home[key === 'aboutTitle' ? 'title' : key === 'aboutText' ? 'text' : key])) {
        out.push({ legacy: 'homepage.' + key, value: legacy.homepage[key] });
      }
    });
  }
  if (legacy.theme && legacy.theme.preset) {
    out.push({ legacy: 'theme.preset', value: legacy.theme.preset });
  }
  return out;
}

async function savePagesV2(pageId, pageData, metaPatch) {
  const raw = await loadRawRow();
  const next = Object.assign({}, raw);
  const saved = Object.assign({}, getSavedPagesV2(raw));
  saved[pageId] = pageData;
  next.pages_v2 = saved;
  const meta = Object.assign({}, getPagesV2Meta(raw), metaPatch || {});
  if (pageId && metaPatch && metaPatch.markPageSaved) {
    meta.savedPages = Object.assign({}, meta.savedPages || {}, { [pageId]: true });
  }
  next.pages_v2_meta = meta;
  const sql = getSql();
  await sql`
    UPDATE site_settings
    SET data = ${JSON.stringify(next)}::jsonb, updated_at = now()
    WHERE id = ${SETTINGS_ID}`;
  return next;
}

async function patchPagesV2Meta(metaPatch) {
  const raw = await loadRawRow();
  const next = Object.assign({}, raw);
  next.pages_v2_meta = Object.assign({}, getPagesV2Meta(raw), metaPatch || {});
  const sql = getSql();
  await sql`
    UPDATE site_settings
    SET data = ${JSON.stringify(next)}::jsonb, updated_at = now()
    WHERE id = ${SETTINGS_ID}`;
  return next;
}

function pageFieldSpecs() {
  return {
    home: {
      heroBadge: 120, heroHeadline: 200, heroSubtext: 800, heroImage: 'url',
      heroBadgeNote: 40, heroBadgeCaption: 80, exploreLabel: 80
    },
    about: {
      eyebrow: 120, title: 120, text: 2000, image: 'url',
      feature0Title: 80, feature0Text: 400, feature1Title: 80, feature1Text: 400,
      feature2Title: 80, feature2Text: 400, plantImage: 'url', plantCaption: 300
    },
    gallery: { title: 120, subtitle: 400 },
    shop: {
      title: 120, lead: 800, demoNote: 400,
      categoryTitles: 'map', categoryBlurbs: 'map'
    },
    process: {
      title: 120,
      step0Title: 80, step0Text: 400, step1Title: 80, step1Text: 400,
      step2Title: 80, step2Text: 400, step3Title: 80, step3Text: 400
    },
    impact: {
      title: 120,
      bullet0: 300, bullet1: 300, bullet2: 300, bullet3: 300,
      stat0Value: 40, stat0Label: 80, stat1Value: 40, stat1Label: 80,
      stat2Value: 40, stat2Label: 80, stat3Value: 40, stat3Label: 80
    },
    contact: {
      title: 120, lead: 500, consultEyebrow: 80, consultTitle: 120, consultLead: 500,
      consultDeposit: 40, consultDepositLabel: 40, consultPayButton: 80,
      consultWaButton: 80, consultNote: 200, whatsappLabel: 80, facebookLabel: 80
    },
    cart: {
      title: 80, intro: 400, emptyText: 400, subtotalLabel: 40,
      checkoutButton: 40, checkoutNote: 200, continueLabel: 80
    },
    footer: {
      brand: 120, tagline: 300, subline: 300, copyright: 300
    }
  };
}

module.exports = {
  DEFAULT_GALLERY,
  defaultPagesV2,
  defaultSettings,
  ensureSiteSchema,
  listGallery,
  loadRawRow,
  getPublicSettings,
  getAdminSettingsPayload,
  savePagesV2,
  patchPagesV2Meta,
  pageFieldSpecs,
  legacyTextDiffs,
  pickLegacy,
  getPagesV2Meta,
  getSavedPagesV2
};
