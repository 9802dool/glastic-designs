/**
 * Verifies iframe preview is not overwritten by /api/settings fetch in visual edit mode.
 * Run: node scripts/verify-visual-preview.mjs (dev server on :3000)
 */
import http from 'http';
import { chromium } from 'playwright';

const ORIGIN = 'http://127.0.0.1:3000';

function waitForServer() {
  return new Promise(function (resolve, reject) {
    let tries = 0;
    function tick() {
      http.get(ORIGIN + '/api/settings', function (res) {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (++tries > 40) reject(new Error('server not ready'));
        else setTimeout(tick, 250);
      }).on('error', function () {
        if (++tries > 40) reject(new Error('server not ready'));
        else setTimeout(tick, 250);
      });
    }
    tick();
  });
}

await waitForServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(ORIGIN + '/scripts/visual-preview-parent.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const headline = await page.frameLocator('#f').locator('#hero-headline').innerText();
const primary = await page.frameLocator('#f').locator('#home').evaluate(function (el) {
  return getComputedStyle(document.documentElement).getPropertyValue('--g-primary').trim();
});
await browser.close();

if (!headline.includes('Preview Headline Works')) {
  console.error('FAIL: headline=', JSON.stringify(headline));
  process.exit(1);
}
if (primary !== '#c2410c') {
  console.error('FAIL: --g-primary=', primary);
  process.exit(1);
}
console.log('OK: preview headline and theme CSS vars stick after fetch window');
