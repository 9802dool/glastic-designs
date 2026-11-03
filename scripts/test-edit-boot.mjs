/**
 * Boot UX for /admin/edit.html — no blank black screen.
 * Run: node scripts/test-edit-boot.mjs (dev server on :3000)
 */
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:3000';

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/admin/edit.html')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not ready');
}

await waitServer();
const browser = await chromium.launch({ headless: true });

// Unsigned: must show sign-in, not blank
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/api/admin/auth**', function (route) {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signedIn: false, needsSetup: false })
      });
    }
    return route.continue();
  });
  await page.goto(ORIGIN + '/admin/edit.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#gate-auth', { timeout: 8000 });
  await page.waitForSelector('#gate-password', { timeout: 8000 });
  const shellHidden = await page.locator('#shell[hidden]').count() > 0;
  const text = await page.locator('#gate').innerText();
  if (!shellHidden || !/Sign in/i.test(text)) {
    console.error('FAIL: unsigned should show sign-in gate, got:', text.slice(0, 80));
    process.exit(1);
  }
  console.log('OK: unsigned shows sign-in form');
  await page.close();
}

// Signed: editor shell visible
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/api/admin/auth**', function (route) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ signedIn: true, needsSetup: false })
    });
  });
  await page.route('**/api/admin/settings**', function (route) {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        })
      });
    }
    return route.continue();
  });
  await page.route('**/api/admin/products**', function (route) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
  });
  await page.goto(ORIGIN + '/admin/edit.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
  await page.waitForSelector('#btn-save', { timeout: 5000 });
  const bg = await page.evaluate(function () {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  const toolbarVisible = await page.locator('.toolbar').isVisible();
  if (!toolbarVisible) {
    console.error('FAIL: signed-in editor toolbar not visible');
    process.exit(1);
  }
  console.log('OK: signed-in shows editor shell (body bg', bg + ')');
  await page.close();
}

// inline-editor.js must be JS not HTML (rewrite check)
{
  const res = await fetch(ORIGIN + '/admin/inline-editor.js');
  const text = await res.text();
  if (!res.ok || text.indexOf('<!DOCTYPE') >= 0 || text.indexOf('function') < 0) {
    console.error('FAIL: inline-editor.js not served as JavaScript');
    process.exit(1);
  }
  console.log('OK: inline-editor.js served correctly');
}

await browser.close();
console.log('All edit boot tests passed');
