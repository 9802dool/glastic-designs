/**
 * Edit mode navigation: nav tabs and toolbar page picker must change route and keep edit mode.
 */
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:3000';

const NAV_TABS = [
  { label: 'about', path: '/about', sel: 'a.nav-link[data-nav-label="about"]' },
  { label: 'shop', path: '/products', sel: 'a.nav-link[data-nav-label="shop"]' },
  { label: 'gallery', path: '/gallery', sel: 'a.nav-link[data-nav-label="gallery"]' },
  { label: 'process', path: '/process', sel: 'a.nav-link[data-nav-label="process"]' },
  { label: 'impact', path: '/impact', sel: 'a.nav-link[data-nav-label="impact"]' },
  { label: 'contact', path: '/contact', sel: 'a.nav-link[data-nav-label="contact"]' }
];

const TOOLBAR_PAGES = [
  { path: '/', label: 'Home' },
  { path: '/products', label: 'Shop' },
  { path: '/about', label: 'About' },
  { path: '/gallery', label: 'Gallery' },
  { path: '/process', label: 'How we make it' },
  { path: '/impact', label: 'Impact' },
  { path: '/contact', label: 'Contact' },
  { path: '/cart', label: 'Cart' },
  { path: '/category/tiles', label: 'Tiles' }
];

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not running');
}

function normalizePath(p) {
  if (!p) return '/';
  let path = p.split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

async function assertEditMode(page, expectedPath) {
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 25000 });
  await page.waitForFunction(function () {
    return window.GLASTIC_VISUAL_EDIT_ACTIVE === true
      && document.querySelectorAll('[data-editable]').length > 0;
  }, { timeout: 15000 });
  const url = new URL(page.url());
  if (normalizePath(url.pathname) !== normalizePath(expectedPath)) {
    throw new Error('Expected path ' + expectedPath + ' got ' + url.pathname);
  }
  if (url.searchParams.get('adminEdit') !== '1' || url.searchParams.get('visualEdit') !== '1') {
    throw new Error('Edit query params missing on ' + page.url());
  }
}

async function openPagePicker(page) {
  await page.locator('#glastic-page-picker-btn').click();
  await page.waitForSelector('#glastic-page-picker-menu:not([hidden])', { timeout: 5000 });
}

async function pickToolbarPage(page, label, expectedPath) {
  const cur = normalizePath(new URL(page.url()).pathname);
  const target = normalizePath(expectedPath);
  await openPagePicker(page);
  const item = page.locator('#glastic-page-picker-menu button.glastic-page-picker-item', { hasText: label });
  if (cur !== target) {
    await Promise.all([
      page.waitForURL(function (url) {
        return normalizePath(url.pathname) === target
          && url.searchParams.get('adminEdit') === '1'
          && url.searchParams.get('visualEdit') === '1';
      }),
      item.click()
    ]);
  } else {
    await item.click();
    await page.locator('#glastic-edit-toolbar').click();
  }
}

const mockSettings = {
  meta: { presets: [{ id: 'forest', label: 'Forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917' }] },
  settings: {
    theme: { preset: 'forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917', fontId: 'playfair-inter', logoUrl: '/logo.jpg' },
    banner: { enabled: false, text: '', link: '' },
    visibility: { hero: true, about: true, gallery: true, products: true, process: true, impact: true, contact: true, consultation: true },
    homepage: { heroHeadline: 'Nav test', heroSubtext: 'x', heroBadge: 'b', heroImage: '/images/living-wall.jpg', heroBadgeNote: '', heroBadgeCaption: '', aboutEyebrow: '', aboutTitle: 'About title', aboutText: '', aboutImage: '/images/owner.jpg', processSteps: [] },
    gallery: { title: 'Gallery', subtitle: '' },
    impact: { title: 'Impact', bullets: [], stats: [] },
    contact: { whatsapp: '1', facebook: '', instagram: '', youtube: '', tiktok: '', contactTitle: 'Contact', contactLead: '' },
    shop: { title: 'Shop', lead: 'Lead' },
    processPage: { title: 'Process' },
    cartPage: { title: 'Cart', intro: '', emptyText: '', subtotalLabel: '', checkoutButton: '', checkoutNote: '', continueLabel: '' },
    nav: {},
    chrome: {}
  },
  gallery: [{ id: 'g1', url: '/images/living-wall.jpg', caption: 'c' }]
};

await waitServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.route('**/api/admin/auth**', function (route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, needsSetup: false }) });
});
await page.route('**/api/admin/settings**', function (route) {
  if (route.request().method() === 'GET') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
  }
  return route.continue();
});
await page.route('**/api/admin/products**', function (route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
});

await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
await assertEditMode(page, '/');

for (const tab of NAV_TABS) {
  await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
  await assertEditMode(page, '/');
  const link = page.locator(tab.sel).first();
  await Promise.all([
    page.waitForURL(function (url) { return normalizePath(url.pathname) === tab.path; }),
    link.click()
  ]);
  await assertEditMode(page, tab.path);
  const hijacked = await page.evaluate(function (label) {
    var el = document.querySelector('a.nav-link[data-nav-label="' + label + '"]');
    return el && el.getAttribute('contenteditable') === 'true';
  }, tab.label);
  if (hijacked) {
    throw new Error('Nav click started inline edit on ' + tab.label);
  }
  console.log('OK: nav tab -> ' + tab.path);
}

await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
await assertEditMode(page, '/');

for (const item of TOOLBAR_PAGES) {
  await pickToolbarPage(page, item.label, item.path);
  await assertEditMode(page, item.path);
  console.log('OK: toolbar -> ' + item.path);
}

await browser.close();
console.log('All edit navigation tests passed');
