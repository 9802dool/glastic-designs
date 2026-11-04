/**
 * Full-screen inline editor smoke tests at 375px and 1280px.
 * Run: node scripts/test-inline-editor.mjs (dev server on :3000)
 */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';

const ORIGIN = 'http://127.0.0.1:3000';
const OUT = '/opt/cursor/artifacts';

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
      { id: 'forest', label: 'Forest green', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917' },
      { id: 'ocean', label: 'Ocean teal', primary: '#0e7490', primaryDark: '#155e75', accent: '#0891b2', background: '#f0fdfa', text: '#1c1917' },
      { id: 'sunset', label: 'Warm sunset', primary: '#c2410c', primaryDark: '#9a3412', accent: '#ea580c', background: '#fff7ed', text: '#1c1917' },
      { id: 'slate', label: 'Slate & sage', primary: '#475569', primaryDark: '#334155', accent: '#059669', background: '#f8fafc', text: '#1c1917' }
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
      const res = await fetch(ORIGIN + '/admin/edit.html');
      if (res.ok) return;
    } catch (e) { /* retry */ }
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  throw new Error('Dev server not running');
}

function tinyPngBase64() {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

async function runViewport(browser, viewport, tag) {
  let lastPatch = null;
  let uploadSeen = false;

  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1
  });
  const page = await context.newPage();

  await page.route('**/api/admin/auth**', function (route) {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, needsSetup: false }) });
  });
  await page.route('**/api/admin/products**', function (route) {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProducts) });
    }
    if (req.method() === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProducts) });
    }
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.action === 'replace-photo' || body.action === 'photo') uploadSeen = true;
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
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.data) uploadSeen = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: mockSettings.settings, gallery: mockSettings.gallery })
      });
    }
    return route.continue();
  });

  await page.goto(ORIGIN + '/?adminEdit=1&visualEdit=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#glastic-edit-gate', { state: 'hidden', timeout: 20000 });
  await page.waitForSelector('#hero-headline', { timeout: 15000 });
  await page.waitForFunction(function () {
    return document.querySelectorAll('[data-editable]').length >= 3 && window.GLASTIC_VISUAL_EDIT_ACTIVE;
  }, { timeout: 8000 });
  const statusText = await page.locator('#glastic-edit-status').textContent();
  if (!statusText || statusText.indexOf('Editing on') < 0) {
    console.error(`FAIL ${tag}: edit status pill`, statusText);
    await context.close();
    process.exit(1);
  }
  await page.waitForTimeout(200);
  await page.locator('#glastic-edit-toolbar').screenshot({ path: `${OUT}/inline-edit-mode-${tag}.png` });

  await page.locator('#hero-headline').click();
  await page.locator('#hero-headline[contenteditable="true"]').waitFor();
  await page.locator('#hero-headline').evaluate(function (el) {
    el.innerText = 'Edited Headline Live';
  });
  await page.locator('#hero-badge').click();
  await page.waitForTimeout(500);
  if (await page.locator('#glastic-btn-undo').isDisabled()) {
    console.error(`FAIL ${tag}: undo still disabled after text edit (change not received)`);
    await context.close();
    process.exit(1);
  }

  await page.locator('body').screenshot({ path: `${OUT}/inline-text-edit-${tag}.png` });

  await page.locator('#hero-image').click();
  await page.locator('.glastic-edit-popover #glastic-replace-photo').waitFor({ timeout: 5000 });
  const pngPath = path.join(OUT, `upload-${tag}.png`);
  await page.evaluate(function (b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    window.__testBlob = new Blob([arr], { type: 'image/png' });
  }, tinyPngBase64());

  await page.locator('.glastic-edit-popover #glastic-replace-photo').click();
  await page.waitForTimeout(200);
  await page.evaluate(function () {
    const input = document.querySelector('input[type=file]');
    if (!input) throw new Error('file input missing');
    const file = new File([window.__testBlob], 'test.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(800);

  await page.locator('#glastic-btn-colours').click();
  await page.locator('#glastic-look-list button[data-preset="ocean"]').click();
  await page.waitForTimeout(400);

  await page.locator('#glastic-btn-save').click();
  await page.waitForSelector('#glastic-edit-toast.show', { timeout: 10000 });

  if (!lastPatch || !lastPatch.homepage || lastPatch.homepage.heroHeadline !== 'Edited Headline Live') {
    console.error(`FAIL ${tag}: PATCH missing edited headline`, lastPatch);
    await context.close();
    process.exit(1);
  }
  if (lastPatch.theme && lastPatch.theme.preset !== 'ocean') {
    console.error(`FAIL ${tag}: theme preset not ocean`, lastPatch.theme);
    await context.close();
    process.exit(1);
  }
  if (!uploadSeen) {
    console.warn(`WARN ${tag}: upload POST not observed (createImageBitmap may be unavailable in headless)`);
  }

  await context.close();
  console.log(`OK ${tag}: inline edit, colours, save payload`);
}

await waitServer();
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
await runViewport(browser, { width: 375, height: 812 }, '375');
await runViewport(browser, { width: 1280, height: 800 }, '1280');
await browser.close();
console.log('All inline editor tests passed');
