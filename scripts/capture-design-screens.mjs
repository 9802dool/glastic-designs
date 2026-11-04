import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const OUT = '/opt/cursor/artifacts';
const LOCAL = 'http://127.0.0.1:3000';
const PROD = 'https://glastic-designs.vercel.app';

const mockAuth = {
  signedIn: true,
  needsSetup: false
};
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
    theme: { preset: 'forest' },
    homepage: { heroHeadline: 'Plastic Waste.\nBeautiful Design.', heroSubtext: 'Intro', aboutText: 'About' }
  },
  gallery: []
};

async function mockAdmin(page) {
  await page.route('**/api/admin/auth**', (r) => r.fulfill({ json: mockAuth }));
  await page.route('**/api/admin/products**', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: mockProducts });
    return r.continue();
  });
  await page.route('**/api/admin/settings**', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: mockSettings });
    return r.continue();
  });
}

const viewports = [
  { name: '375', width: 375, height: 812 },
  { name: '1280', width: 1280, height: 900 }
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await mockAdmin(page);
  await page.goto(LOCAL + '/admin/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/admin-menu-${vp.name}.png`, fullPage: true });
  await page.locator('.menu-btn').filter({ hasText: 'Change a price' }).click();
  await page.waitForSelector('.pick-list, .empty-state');
  await page.screenshot({ path: `${OUT}/admin-job-price-${vp.name}.png`, fullPage: true });
  await ctx.close();
}

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(LOCAL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/public-home-branch-${vp.name}.png`, fullPage: false });
  await page.goto(PROD + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/public-home-prod-${vp.name}.png`, fullPage: false });
  await ctx.close();
}

await browser.close();
console.log('Screenshots saved to', OUT);
