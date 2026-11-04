/**
 * Public site: settings.js must boot after DOM (gallery grid, no page errors).
 */
import { chromium } from 'playwright';

const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:3000';
const ROUTES = ['/', '/gallery', '/products', '/about'];

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(ORIGIN + '/')).ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Server not ready: ' + ORIGIN);
}

await waitServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

for (const route of ROUTES) {
  pageErrors.length = 0;
  await page.goto(ORIGIN + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(function () {
    return document.getElementById('gallery-grid') || document.getElementById('product-grid') || document.getElementById('hero-headline');
  }, { timeout: 15000 });
  if (pageErrors.some(function (m) { return m.indexOf("reading 'style'") >= 0; })) {
    throw new Error('settings.js body/style error on ' + route + ': ' + pageErrors.join('; '));
  }
  if (route === '/gallery') {
    const count = await page.locator('#gallery-grid figure').count();
    if (count < 1) {
      throw new Error('Gallery route has no figures (expected API/default gallery)');
    }
    console.log('OK: /gallery has', count, 'photos');
  }
  const tw = await page.evaluate(function () {
    var el = document.querySelector('.max-w-7xl');
    return el && getComputedStyle(el).maxWidth;
  });
  if (!tw || tw === 'none') throw new Error('Tailwind layout missing on ' + route);
  console.log('OK:', route, 'styled, no settings boot error');
}

await browser.close();
console.log('Public site boot tests passed');
