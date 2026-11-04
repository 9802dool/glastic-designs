#!/usr/bin/env node
/**
 * Headless checks for public routes. Usage:
 *   BASE_URL=https://your-preview.vercel.app node scripts/test-pages-dashboard.mjs
 *   BASE_URL=https://glastic-designs.vercel.app node scripts/test-pages-dashboard.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const ROUTES = ['/', '/about', '/gallery', '/products', '/category/tiles', '/category/planters', '/process', '/impact', '/contact', '/cart'];

fs.mkdirSync(OUT, { recursive: true });

const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push({ route: page.url(), type: 'pageerror', message: e.message }));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/503.*\/api\/(products|admin)/.test(text)) return;
    if (text.includes('Failed to load resource') && text.includes('503')) return;
    errors.push({ route: page.url(), type: 'console', message: text });
  });

  for (const route of ROUTES) {
    const url = BASE + route;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    const galleryCount = await page.locator('#gallery-grid figure').count();
    if (route === '/gallery' && galleryCount < 1) {
      errors.push({ route, type: 'assert', message: 'gallery count is 0' });
    }
    if (route === '/gallery') {
      const broken = await page.evaluate(function () {
        var grid = document.getElementById('gallery-grid');
        if (!grid) return [];
        return Array.from(grid.querySelectorAll('img')).filter(function (img) {
          return img.src && img.complete && img.naturalWidth === 0;
        }).map(function (img) { return img.src; });
      });
      if (broken.length) errors.push({ route, type: 'images', message: broken.join(', ') });
    }
    const slug = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
    await shot(page, 'public-' + slug);
  }

  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await shot(page, 'admin-signin-mobile');

  await browser.close();
  const report = { base: BASE, routes: ROUTES.length, errors };
  fs.writeFileSync(path.join(OUT, 'test-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
