/**
 * Site-wide edit mode: every public route has editable items; save persists.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { defaultSettings } = require('../api/lib/site-settings.js');

const ORIGIN = 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';
const PASSWORD = 'test-admin-pass-99';

const ROUTES = [
  { path: '/', name: 'home', textSel: '#hero-headline', imageSel: '#hero-image' },
  { path: '/products', name: 'products', textSel: '#products-title', imageSel: '#site-logo' },
  { path: '/category/tiles', name: 'category-tiles', textSel: '#products-title', imageSel: '#site-logo' },
  { path: '/category/planters', name: 'category-planters', textSel: '#products-lead', imageSel: '#site-logo' },
  { path: '/category/furniture', name: 'category-furniture', textSel: '#products-lead', imageSel: '#site-logo' },
  { path: '/category/gifts', name: 'category-gifts', textSel: '#products-lead', imageSel: '#site-logo' },
  { path: '/category/services', name: 'category-services', textSel: '#products-lead', imageSel: '#site-logo' },
  { path: '/about', name: 'about', textSel: '#about-title', imageSel: '#about-image' },
  { path: '/gallery', name: 'gallery', textSel: '#gallery-title', imageSel: '#gallery-grid img' },
  { path: '/process', name: 'process', textSel: '#process-page-title', imageSel: '#site-logo' },
  { path: '/impact', name: 'impact', textSel: '#impact-title', imageSel: '#site-logo' },
  { path: '/contact', name: 'contact', textSel: '#contact-title', imageSel: '#site-logo' },
  { path: '/cart', name: 'cart', textSel: '#cart-page-title', imageSel: '#site-logo' }
];

function deepMergeSettings(base, patch) {
  const next = JSON.parse(JSON.stringify(base));
  Object.keys(patch).forEach(function (key) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key]) && next[key] && typeof next[key] === 'object') {
      next[key] = Object.assign({}, next[key], patch[key]);
    } else {
      next[key] = patch[key];
    }
  });
  return next;
}

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not running');
}

async function run() {
  let signedIn = false;
  let settings = { settings: defaultSettings(), gallery: [] };
  let lastPatch = null;
  let products = {
    products: [{
      id: 'tiles',
      name: 'Plastic Tiles',
      description: 'Tile description',
      category: 'Tiles',
      priceTtd: 25,
      hidden: false,
      photos: [{ id: 'p1', url: '/images/triangle-planter.jpg', isMain: true }]
    }]
  };

  const report = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.route('**/api/admin/auth**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn, needsSetup: false }) });
    }
    if (req.method() === 'POST') {
      signedIn = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.continue();
  });

  await page.route('**/api/admin/settings**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({ meta: { presets: [] } }, settings)) });
    }
    if (req.method() === 'PATCH') {
      const patch = JSON.parse(req.postData() || '{}');
      lastPatch = patch;
      settings.settings = deepMergeSettings(settings.settings, patch);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: settings.settings, gallery: settings.gallery })
      });
    }
    if (req.method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: settings.settings, gallery: settings.gallery }) });
    }
    return route.continue();
  });

  await page.route('**/api/admin/products**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) });
    }
    return route.continue();
  });

  await page.route('**/api/settings**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) });
  });

  await page.route('**/api/products**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) });
  });

  await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
  if (await page.locator('#gate-auth').count()) {
    await page.locator('#gate-password').fill(PASSWORD);
    await page.locator('#gate-auth button[type="submit"]').click();
    await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  }

  for (const route of ROUTES) {
    await page.goto(ORIGIN + route.path + '?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 25000 });
    await page.waitForFunction(function () {
      return window.GLASTIC_VISUAL_EDIT_ACTIVE && document.querySelectorAll('[data-editable]').length > 0;
    }, { timeout: 12000 });

    const audit = await page.evaluate(function () {
      var visible = Array.from(document.querySelectorAll('[data-editable]')).filter(function (el) {
        return el.getClientRects().length > 0;
      });
      var keys = visible.map(function (el) { return el.getAttribute('data-editable'); });
      var skipped = [];
      var pageEl = document.querySelector('html[class*="route-"]');
      var main = document.querySelector('.site-page[style*="block"], section.site-page');
      var sections = document.querySelectorAll('section.site-page, #cart-page.site-page');
      sections.forEach(function (sec) {
        if (sec.getClientRects().length === 0) return;
        sec.querySelectorAll('h1,h2,h3,p,span,a,button,figcaption').forEach(function (node) {
          if (!node.id && !node.getAttribute('data-editable') && node.getClientRects().length > 0) {
            var t = (node.textContent || '').trim();
            if (t.length > 2 && t.length < 200 && !node.closest('#glastic-edit-toolbar')) {
              skipped.push(node.tagName + ':' + t.slice(0, 40));
            }
          }
        });
      });
      return { count: visible.length, keys: keys.slice(0, 30), skipped: skipped.slice(0, 8) };
    });

    if (audit.count === 0) {
      throw new Error('No visible editables on ' + route.path);
    }

    const textEl = page.locator(route.textSel).first();
    await textEl.click();
    await page.waitForSelector(route.textSel + '[contenteditable="true"]', { timeout: 5000 });
    const marker = 'EDIT-' + route.name;
    await page.keyboard.press('Control+A');
    await page.keyboard.type(marker);
    await page.locator('#glastic-edit-toolbar').click();
    await page.waitForFunction(function () {
      var undo = document.getElementById('glastic-btn-undo');
      return undo && !undo.disabled;
    }, { timeout: 5000 }).catch(function () { /* some chrome fields may not undo */ });
    await page.waitForTimeout(100);

    if (['about', 'products', 'gallery'].includes(route.name)) {
      await page.screenshot({ path: `${OUT}/edit-mode-${route.name}.png` });
    }

    report.push({
      page: route.path,
      editableCount: audit.count,
      sampleKeys: audit.keys,
      notEditableNotes: audit.skipped.length ? audit.skipped.join('; ') : 'none significant (icons/decorative/cart runtime)'
    });
  }

  await page.goto(ORIGIN + '/products?adminEdit=1&visualEdit=1&product=tiles', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  await page.waitForSelector('#page-tiles:not(.hidden)', { timeout: 8000 });
  const detailCount = await page.locator('#page-tiles:not(.hidden) [data-editable]').count();
  if (detailCount === 0) throw new Error('Product detail overlay has no editables');
  await page.locator('#page-tiles:not(.hidden) h1').click();
  await page.locator('#page-tiles:not(.hidden) h1[contenteditable="true"]').waitFor();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('EDIT-product-detail');
  await page.locator('#glastic-edit-toolbar').click();
  report.push({ page: 'product-detail-overlay', editableCount: detailCount, sampleKeys: ['product.*'], notEditableNotes: 'cart/qty controls excluded by design' });

  await page.locator('#glastic-btn-save').click();
  await page.waitForSelector('#glastic-edit-toast.show', { timeout: 15000 });
  console.log('PATCH homepage.aboutTitle', lastPatch && lastPatch.homepage && lastPatch.homepage.aboutTitle);
  console.log('PATCH cartPage.title', lastPatch && lastPatch.cartPage && lastPatch.cartPage.title);

  if (settings.settings.homepage.aboutTitle !== 'EDIT-about') {
    throw new Error('Stored settings missing about edit: ' + settings.settings.homepage.aboutTitle);
  }
  if (settings.settings.cartPage.title !== 'EDIT-cart') {
    throw new Error('Stored settings missing cart edit: ' + settings.settings.cartPage.title);
  }

  await page.goto(ORIGIN + '/about?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  await page.waitForFunction(function () {
    var t = document.getElementById('about-title');
    return t && t.textContent.indexOf('EDIT-about') >= 0;
  }, { timeout: 10000 });

  await page.goto(ORIGIN + '/cart?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  await page.waitForFunction(function () {
    var t = document.getElementById('cart-page-title');
    return t && t.textContent.indexOf('EDIT-cart') >= 0;
  }, { timeout: 10000 });

  await writeFile(`${OUT}/edit-route-audit.json`, JSON.stringify(report, null, 2));
  console.log('Per-route edit audit:');
  report.forEach(function (row) {
    console.log('-', row.page, '| editables:', row.editableCount, '| gaps:', row.notEditableNotes);
  });
  console.log('OK: all routes edit mode + persistence spot-check');
  await browser.close();
}

await waitServer();
await mkdir(OUT, { recursive: true });
await run();
