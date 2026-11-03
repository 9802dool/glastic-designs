/**
 * Cold load same-document editor: sign in, edit hero + product price, save PATCH.
 * Run: node scripts/test-edit-e2e-cold.mjs (dev server on :3000)
 */
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:3000';
const ADMIN_PASSWORD = 'test-admin-pass-99';

const mockProducts = {
  products: [{
    id: 'tiles',
    name: 'Plastic Tiles',
    description: 'Sample tile description',
    category: 'Tiles',
    priceTtd: 25,
    hidden: false,
    photos: [{ id: 'p1', url: '/images/triangle-planter.jpg', isMain: true }]
  }]
};

const mockSettings = {
  meta: {
    presets: [
      { id: 'forest', label: 'Forest green', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917' }
    ]
  },
  settings: {
    theme: { preset: 'forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917', fontId: 'playfair-inter', logoUrl: '/logo.jpg' },
    banner: { enabled: false, text: '', link: '' },
    visibility: { hero: true, about: true, gallery: true, products: true, process: true, impact: true, contact: true, consultation: true },
    homepage: {
      heroBadge: 'Badge',
      heroHeadline: 'Plastic Waste.\nBeautiful Design.',
      heroSubtext: 'Intro text here',
      heroImage: '/images/living-wall.jpg',
      heroBadgeNote: 'T&T',
      heroBadgeCaption: 'Caption',
      aboutEyebrow: 'Eyebrow',
      aboutTitle: 'About title',
      aboutText: 'About story',
      aboutImage: '/images/owner.jpg',
      processSteps: [{ title: 'Collect', text: 'Step one' }]
    },
    gallery: { title: 'Gallery', subtitle: 'Sub' },
    impact: { title: 'Impact', bullets: ['One'], stats: [{ value: '100%', label: 'Recycled' }] },
    contact: {
      whatsapp: '18687752407',
      facebook: 'https://www.facebook.com/gdistyles',
      instagram: '',
      youtube: '',
      tiktok: '',
      contactTitle: 'Contact us',
      contactLead: 'Lead text'
    }
  },
  gallery: []
};

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(ORIGIN + '/');
      if (res.ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not running');
}

async function run() {
  let signedIn = false;
  let lastPatch = null;
  let lastProductPatch = null;

  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge'
  }).catch(function () {
    return chromium.launch({ headless: true });
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', function (msg) {
    if (String(msg.text()).indexOf('[glastic-edit]') >= 0) {
      console.log('console:', msg.text());
    }
  });

  await page.route('**/api/admin/auth**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signedIn: signedIn, needsSetup: false })
      });
    }
    if (req.method() === 'POST') {
      signedIn = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.continue();
  });

  await page.route('**/api/admin/products**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProducts) });
    }
    if (req.method() === 'PATCH') {
      lastProductPatch = JSON.parse(req.postData() || '{}');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProducts) });
    }
    return route.continue();
  });

  await page.route('**/api/admin/settings**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
    }
    if (req.method() === 'PATCH') {
      lastPatch = JSON.parse(req.postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: mockSettings.settings, gallery: mockSettings.gallery })
      });
    }
    return route.continue();
  });

  await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('#gate-auth, #glastic-edit-gate form#gate-auth', { timeout: 15000 });
  await page.locator('#gate-password').fill(ADMIN_PASSWORD);
  await page.locator('#gate-auth button[type="submit"]').click();

  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  await page.waitForFunction(function () {
    return document.querySelectorAll('[data-editable]').length >= 3
      && window.GLASTIC_VISUAL_EDIT_ACTIVE === true;
  }, { timeout: 8000 });

  const status = await page.locator('#glastic-edit-status').textContent();
  if (!status || status.indexOf('Editing on') < 0) {
    throw new Error('Status pill not showing edit mode: ' + status);
  }

  await page.locator('#hero-headline').click();
  await page.locator('#hero-headline[contenteditable="true"]').waitFor({ timeout: 5000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Cold E2E Headline');
  await page.locator('#hero-subtext').click();
  await page.waitForFunction(function () {
    var undo = document.getElementById('glastic-btn-undo');
    return undo && !undo.disabled;
  }, { timeout: 5000 });

  page.once('dialog', function (d) { d.accept(); });
  await Promise.all([
    page.waitForURL(/\/products(\?|$)/),
    page.locator('#glastic-page-select').selectOption('/products')
  ]);
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 25000 });
  await page.waitForFunction(function () {
    return document.querySelector('.product-card [data-editable-kind="price"]')
      && window.GLASTIC_VISUAL_EDIT_ACTIVE === true;
  }, { timeout: 15000 });

  const priceEl = page.locator('.product-card [data-editable-kind="price"]').first();
  await priceEl.click();
  await page.waitForSelector('.product-card [data-editable-kind="price"][contenteditable="true"]');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('42');
  await page.locator('#glastic-edit-toolbar').click();
  await page.waitForFunction(function () {
    var undo = document.getElementById('glastic-btn-undo');
    return undo && !undo.disabled;
  }, { timeout: 5000 });

  page.once('dialog', function (d) { d.accept(); });
  await Promise.all([
    page.waitForURL(function (url) {
      var p = url.pathname.replace(/\/$/, '') || '/';
      return p === '/';
    }),
    page.locator('#glastic-page-select').selectOption('/')
  ]);
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 25000 });

  await page.locator('#glastic-btn-save').click();
  await page.waitForSelector('#glastic-edit-toast.show', { timeout: 15000 });

  if (!lastPatch || lastPatch.homepage?.heroHeadline !== 'Cold E2E Headline') {
    throw new Error('Settings PATCH missing hero headline: ' + JSON.stringify(lastPatch));
  }
  if (!lastProductPatch || String(lastProductPatch.priceTtd) !== '42') {
    throw new Error('Product PATCH missing price 42: ' + JSON.stringify(lastProductPatch));
  }

  await browser.close();
  console.log('OK: cold same-document E2E (sign-in, hero, product price, save)');
}

await waitServer();
await run();
