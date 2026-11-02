const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('./auth');
const { slugify, cleanPrice, cleanText } = require('./http');

test('password hash verifies and rejects a different password', async () => {
  const stored = await auth.hashPassword('owner-secret-pass');
  assert.equal(await auth.verifyPassword('owner-secret-pass', stored), true);
  assert.equal(await auth.verifyPassword('other-secret-pass', stored), false);
  assert.equal(stored.includes('owner-secret-pass'), false);
});

test('slug and price helpers stay safe', () => {
  assert.equal(slugify('Coasters & Clock'), 'coasters-clock');
  assert.equal(cleanPrice('25.5'), 25.5);
  assert.equal(cleanPrice('-1'), null);
  assert.equal(cleanText('  Hello   tiles  ', 20), 'Hello tiles');
  assert.equal(cleanText('', 20, { allowEmpty: true }), '');
});
