/**
 * Final marketing screenshots with realistic Glastic copy (mocked admin auth).
 * Run: node scripts/capture-final-screens.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const ORIGIN = 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';

const mockSettings = {
  meta: {
    presets: [
      { id: 'forest', label: 'Forest green', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917' },
      { id: 'ocean', label: 'Ocean teal', primary: '#0e7490', primaryDark: '#155e75', accent: '#0891b2', background: '#f0fdfa', text: '#1c1917' },
      { id: 'sunset', label: 'Warm sunset', primary: '#c2410c', primaryDark: '#9a3412', accent: '#ea580c', background: '#fff7ed', text: '#1c1917' },
      { id: 'slate', label: 'Slate & sage', primary: '#475569', primaryDark: '#334155', accent: '#059669', background: '#f8fafc', text: '#1c1917' }
    ]
  },
  settings: {
    theme: { preset: 'forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917', fontId: 'playfair-inter', logoUrl: '/logo.jpg' },
    banner: { enabled: false, text: '', link: '' },
    visibility: { hero: true, about: true, gallery: true, products: true, process: true, impact: true, contact: true, consultation: true },
    homepage: {
      heroBadge: 'Made in Trinidad & Tobago ♻️',
      heroHeadline: 'Plastic Waste.\nBeautiful Design.',
      heroSubtext: 'We transform discarded plastic into durable, stylish interior products — tiles, furniture, coasters and more.',
      heroImage: '/images/living-wall.jpg',
      heroBadgeNote: 'T&T',
      heroBadgeCaption: 'Living walls & planters',
      aboutEyebrow: "We are nature's Keepers",
      aboutTitle: 'From Waste to Wonder',
      aboutText: 'Founded by Alicia Barrie-George, Glastic Designs turns plastic waste into high-value interior products.',
      aboutImage: '/images/owner.jpg',
      processSteps: [
        { title: 'Collect', text: 'Plastic waste from events and partners across Trinidad and Tobago.' },
        { title: 'Sort & Shred', text: 'Sorted by type and colour, then shredded for quality.' }
      ]
    },
    gallery: { title: "Nature's Keepers", subtitle: 'Living walls and planters from our work in Trinidad and Tobago.' },
    impact: {
      title: 'Making a Difference',
      bullets: ['Collected tens of kilograms at community events'],
      stats: [{ value: '100%', label: 'Plastic waste products' }]
    },
    contact: {
      whatsapp: '18687752407',
      facebook: 'https://www.facebook.com/gdistyles',
      instagram: 'https://instagram.com/glasticdesigns',
      youtube: '',
      tiktok: '',
      contactTitle: 'Ready to Order or Partner?',
      contactLead: 'DM us on Facebook, WhatsApp, or follow our journey.'
    }
  },
  gallery: []
};

const mockProducts = {
  products: [{
    id: 'tiles',
    name: 'Plastic Tiles',
    description: 'Durable, waterproof tiles made from plastic waste.',
    category: 'Tiles',
    priceTtd: 25,
    hidden: false,
    photos: [{ id: 'p1', url: '/images/triangle-planter.jpg', isMain: true }]
  }]
};

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/logo.jpg')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not ready');
}

async function mockAdminRoutes(page) {
  await page.route('**/api/admin/auth**', function (route) {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, needsSetup: false }) });
  });
  await page.route('**/api/admin/products**', function (route) {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProducts) });
    }
    return route.continue();
  });
  await page.route('**/api/admin/settings**', function (route) {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
    }
    return route.continue();
  });
}

async function captureEditor(page, width, height, name) {
  await page.setViewportSize({ width, height });
  await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  await page.waitForSelector('#hero-headline', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator('body').screenshot({ path: `${OUT}/${name}` });
}

await waitServer();
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await mockAdminRoutes(page);

await captureEditor(page, 375, 812, 'inline-edit-mode-375.png');

const page2 = await browser.newPage();
await mockAdminRoutes(page2);
await page2.setViewportSize({ width: 375, height: 812 });
await page2.goto(ORIGIN + '/admin/', { waitUntil: 'networkidle' });
await page2.waitForSelector('.menu-list');
await page2.screenshot({ path: `${OUT}/admin-simple-menu-375.png`, fullPage: true });

const page3 = await browser.newPage();
await mockAdminRoutes(page3);
await captureEditor(page3, 1280, 800, 'inline-edit-mode-1280.png');

const page4 = await browser.newPage();
await mockAdminRoutes(page4);
await page4.setViewportSize({ width: 1280, height: 800 });
await page4.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
await page4.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
await page4.locator('#hero-headline').click();
await page4.locator('#hero-headline[contenteditable="true"]').waitFor();
await page4.locator('#hero-subtext').click();
await page4.waitForTimeout(400);
await page4.locator('body').screenshot({ path: `${OUT}/inline-text-edit-1280.png` });

await browser.close();
console.log('Saved final screenshots to', OUT);
