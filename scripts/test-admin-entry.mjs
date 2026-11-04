/**
 * /admin opens editor gateway; tasks menu reachable from toolbar.
 */
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:3000';
const EDITOR = '/?adminEdit=1&visualEdit=1';

const mockSettings = {
  meta: { presets: [] },
  settings: {
    theme: { logoUrl: '/logo.jpg' },
    banner: { enabled: false },
    visibility: { hero: true, about: true, gallery: true, products: true, process: true, impact: true, contact: true },
    homepage: { heroHeadline: 'Hi', heroSubtext: '', heroBadge: '', heroImage: '/images/living-wall.jpg', processSteps: [] },
    gallery: { title: '' },
    impact: { title: '' },
    contact: {},
    shop: {},
    processPage: {},
    cartPage: {},
    nav: {},
    chrome: {}
  },
  gallery: []
};

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/admin/')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not running');
}

await waitServer();
const browser = await chromium.launch({ headless: true });

{
  const page = await browser.newPage();
  let signedIn = false;
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
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
  });
  await page.route('**/api/admin/products**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
  });

  await page.goto(ORIGIN + '/admin/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#gate-password', { timeout: 10000 });
  await page.fill('#gate-password', 'test-pass-1234');
  await Promise.all([
    page.waitForURL(function (url) {
      return url.searchParams.get('adminEdit') === '1' && url.searchParams.get('visualEdit') === '1';
    }),
    page.click('#gate-auth button[type="submit"]')
  ]);
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 25000 });
  await page.waitForFunction(function () {
    return window.GLASTIC_VISUAL_EDIT_ACTIVE === true
      && document.querySelectorAll('[data-editable]').length > 0;
  }, { timeout: 15000 });
  console.log('OK: /admin signed out -> sign in -> editor with outlines');
  await page.close();
}

{
  const page = await browser.newPage();
  await page.route('**/api/admin/auth**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, needsSetup: false }) });
  });
  await page.route('**/api/admin/settings**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
  });
  await page.route('**/api/admin/products**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
  });

  await page.goto(ORIGIN + '/admin/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(function (url) {
    return url.pathname === '/' && url.searchParams.get('adminEdit') === '1';
  }, { timeout: 15000 });
  await page.waitForSelector('#glastic-edit-toolbar', { timeout: 15000 });
  console.log('OK: signed in /admin redirects straight to editor');
  await page.locator('#glastic-btn-tasks').click();
  await page.waitForURL(/\/admin\/tasks\.html/, { timeout: 10000 });
  await page.waitForSelector('.menu-list', { timeout: 10000 });
  console.log('OK: toolbar Tasks opens quick tasks menu');
  await page.close();
}

await browser.close();
console.log('All admin entry tests passed');
