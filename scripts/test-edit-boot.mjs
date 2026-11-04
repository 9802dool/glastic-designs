/**
 * Boot UX: /admin gateway + same-document /?adminEdit=1&visualEdit=1
 */
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:3000';

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/admin/')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not ready');
}

const mockSettings = {
  meta: { presets: [{ id: 'forest', label: 'Forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917' }] },
  settings: {
    theme: { preset: 'forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917', fontId: 'playfair-inter', logoUrl: '/logo.jpg' },
    banner: { enabled: false, text: '', link: '' },
    visibility: { hero: true, about: true, gallery: true, products: true, process: true, impact: true, contact: true, consultation: true },
    homepage: { heroHeadline: 'Test', heroSubtext: 'x', heroBadge: 'b', heroImage: '/images/living-wall.jpg', heroBadgeNote: '', heroBadgeCaption: '', aboutEyebrow: '', aboutTitle: '', aboutText: '', aboutImage: '/images/owner.jpg', processSteps: [] },
    gallery: { title: '', subtitle: '' },
    impact: { title: '', bullets: [], stats: [] },
    contact: { whatsapp: '1', facebook: '', instagram: '', youtube: '', tiktok: '', contactTitle: '', contactLead: '' }
  },
  gallery: []
};

await waitServer();
const browser = await chromium.launch({ headless: true });

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/api/admin/auth**', function (route) {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: false, needsSetup: false }) });
    }
    return route.continue();
  });
  await page.goto(ORIGIN + '/admin/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#gate-password', { timeout: 8000 });
  console.log('OK: /admin gateway shows sign-in when unsigned');
  await page.close();
}

{
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
  await page.waitForSelector('#glastic-edit-toolbar', { timeout: 15000 });
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 15000 });
  await page.waitForSelector('#hero-headline', { timeout: 5000 });
  const toolbar = await page.locator('#glastic-btn-save').innerText();
  if (toolbar.indexOf('Save') < 0) {
    console.error('FAIL: toolbar missing Save');
    process.exit(1);
  }
  console.log('OK: same-document editor shows site + toolbar');
  await page.close();
}

await browser.close();
console.log('All edit boot tests passed');
