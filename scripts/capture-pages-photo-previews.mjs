#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { defaultPagesV2, DEFAULT_GALLERY } = require('../api/lib/site-settings.js');
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots';
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

fs.mkdirSync(OUT, { recursive: true });

function mockSettingsPayload() {
  const defaults = defaultPagesV2();
  const gallery = DEFAULT_GALLERY.map(function (item, i) {
    return { id: item.id, url: item.url, caption: item.caption, sortOrder: i };
  });
  return {
    defaults: defaults,
    pages_v2: {},
    pages_v2_meta: { galleryLive: false, savedPages: {} },
    gallery: gallery,
    legacy: {},
    legacyDiffs: []
  };
}

async function measureAbout(page) {
  return page.evaluate(function () {
    var img = document.querySelector('[data-content-image="about.image"] img');
    if (!img) return null;
    var r = img.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), ratio: r.width / r.height };
  });
}

async function openPagesAboutAdmin(page) {
  const payload = mockSettingsPayload();
  await page.route('**/api/admin/auth**', function (route) {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, needsSetup: false }) });
  });
  await page.route('**/api/admin/products**', function (route) {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: [] }) });
  });
  await page.route('**/api/admin/settings**', function (route) {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.click('[data-admin-tab="pages"]');
  await page.waitForTimeout(400);
  await page.click('[data-page="about"]');
  await page.waitForTimeout(500);
}

async function adminPreviewMetrics(page) {
  return page.evaluate(function () {
    var img = document.querySelector('body.pages-editor .page-photo-preview');
    if (!img) return null;
    var s = getComputedStyle(img);
    var r = img.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      ratio: r.width / r.height,
      objectFit: s.objectFit,
      radius: s.borderRadius
    };
  });
}

async function captureViewport(browser, width, label) {
  const ctx = await browser.newContext({ viewport: { width: width, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(600);
  const aboutMetrics = await measureAbout(page);
  const aboutShot = path.join(OUT, 'verify-about-public-' + label + '.png');
  await page.locator('[data-content-image="about.image"]').screenshot({ path: aboutShot });

  await openPagesAboutAdmin(page);
  const adminMetrics = await adminPreviewMetrics(page);
  const adminShot = path.join(OUT, 'verify-admin-about-previews-' + label + '.png');
  await page.locator('body.pages-editor .card').first().screenshot({ path: adminShot });

  const compareHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:system-ui,sans-serif;background:#fafaf9}
    h2{font-size:14px;margin:0 0 8px;color:#44403c}
    .row{display:flex;gap:16px;padding:16px;align-items:flex-start;flex-wrap:wrap}
    .col{flex:1;min-width:280px;max-width:${width}px}
    img{width:100%;height:auto;border:1px solid #e7e5e4;border-radius:8px}
    .meta{font-size:12px;color:#57534e;margin-top:6px}
  </style></head><body>
  <div class="row">
    <div class="col"><h2>Public About photo</h2><img src="file://${aboutShot}"><p class="meta">${aboutMetrics ? aboutMetrics.w + '×' + aboutMetrics.h + ' (ratio ' + aboutMetrics.ratio.toFixed(4) + ')' : 'n/a'}</p></div>
    <div class="col"><h2>Admin Pages previews (About)</h2><img src="file://${adminShot}"><p class="meta">${adminMetrics ? adminMetrics.w + '×' + adminMetrics.h + ' (ratio ' + adminMetrics.ratio.toFixed(4) + ')' : 'n/a'}</p></div>
  </div></body></html>`;
  const htmlPath = path.join(OUT, 'compare-' + label + '.html');
  fs.writeFileSync(htmlPath, compareHtml);
  const comparePage = await ctx.newPage();
  await comparePage.setViewportSize({ width: Math.min(width * 2 + 80, 1800), height: 1000 });
  await comparePage.goto('file://' + htmlPath, { waitUntil: 'load' });
  await comparePage.waitForTimeout(300);
  const compareShot = path.join(OUT, 'verify-side-by-side-' + label + '.png');
  await comparePage.screenshot({ path: compareShot, fullPage: true });

  await page.click('[data-page="gallery"]');
  await page.waitForTimeout(400);
  await page.locator('body.pages-editor .photo-card').first().screenshot({
    path: path.join(OUT, 'verify-admin-gallery-preview-' + label + '.png')
  });

  await ctx.close();
  return { aboutMetrics, adminMetrics, aboutShot, adminShot, compareShot };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const r1280 = await captureViewport(browser, 1280, '1280');
  const r390 = await captureViewport(browser, 390, '390');
  await browser.close();
  const report = {
    base: BASE,
    desktop: r1280,
    mobile: r390,
    targetAspect: 588 / 448
  };
  fs.writeFileSync(path.join(OUT, 'pages-photo-preview-verify.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
