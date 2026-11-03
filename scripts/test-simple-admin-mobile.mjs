/**
 * Phone-width UI smoke test for /admin (mocked auth).
 * Run: node scripts/test-simple-admin-mobile.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const ORIGIN = 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';

const mockProducts = {
  products: [{
    id: 'tiles',
    name: 'Plastic Tiles',
    description: 'Sample',
    category: 'Tiles',
    priceTtd: 25,
    hidden: false,
    photos: [{ id: 'p1', url: '/images/triangle-planter.jpg', isMain: true }]
  }]
};

const mockSettings = {
  settings: {
    theme: { preset: 'forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917', fontId: 'playfair-inter', logoUrl: '/logo.jpg' },
    homepage: {
      heroHeadline: 'Plastic Waste.\nBeautiful Design.',
      heroSubtext: 'We transform discarded plastic…',
      aboutText: 'Founded by Alicia…'
    }
  },
  gallery: []
};

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(ORIGIN + '/admin/');
      if (res.ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not running on ' + ORIGIN);
}

await waitServer();
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  deviceScaleFactor: 2
});
const page = await context.newPage();

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

await page.goto(ORIGIN + '/admin/', { waitUntil: 'networkidle' });
await page.waitForSelector('text=What would you like to do?');
await page.screenshot({ path: OUT + '/admin-simple-menu-mobile.png', fullPage: true });

const menuCount = await page.locator('.menu-btn').count();
if (menuCount !== 6) {
  console.error('FAIL: expected 6 menu buttons, got', menuCount);
  process.exit(1);
}

await page.locator('.menu-btn').filter({ hasText: 'Change my homepage words' }).click();
await page.waitForSelector('text=Homepage words');
await page.screenshot({ path: OUT + '/admin-simple-words-mobile.png', fullPage: true });

await page.locator('#back-btn').click();
await page.locator('.menu-btn').filter({ hasText: 'Change my colours' }).click();
await page.waitForSelector('text=Pick a look');
await page.screenshot({ path: OUT + '/admin-simple-colours-mobile.png', fullPage: true });

await browser.close();
console.log('OK: simple admin mobile UI (375px) — menu, words, colours screens');
