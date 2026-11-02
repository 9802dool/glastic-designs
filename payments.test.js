const test = require('node:test');
const assert = require('node:assert/strict');
const pay = require('./payments.js');

const NOW = new Date('2026-11-02T12:00:00Z');

function sessionFor(id, mode) {
  const item = pay.CATALOG[id];
  const resolved = pay.resolveMode(item, mode);
  return {
    item,
    mode: resolved,
    amount: pay.amountFor(item, resolved),
    orderId: 'GD-261102-TEST'
  };
}

test('full prices use a 50 percent deposit', () => {
  for (const item of Object.values(pay.CATALOG)) {
    if (item.pay == null) {
      assert.equal(pay.resolveMode(item, 'pay'), 'deposit');
      assert.equal(pay.amountFor(item, 'pay'), item.deposit);
    } else {
      assert.equal(item.deposit * 2, item.pay);
      assert.equal(pay.amountFor(item, 'pay'), item.pay);
      assert.equal(pay.amountFor(item, 'deposit'), item.deposit);
    }
    assert.equal(item.deposit > 0, true);
  }
});

test('amounts format as TTD', () => {
  assert.equal(pay.formatTTD(250), '$250.00 TTD');
  assert.equal(pay.formatTTD(100), '$100.00 TTD');
});

test('checkout payload is order data only', () => {
  const payload = pay.buildCheckoutPayload(sessionFor('benches', 'pay'));
  assert.deepEqual(Object.keys(payload).sort(), [
    'amount', 'currency', 'description', 'items', 'kind', 'orderId', 'provider'
  ]);
  assert.equal(payload.provider, 'demo');
  assert.equal(payload.currency, 'TTD');
  assert.equal(payload.amount, 250);
  assert.equal(payload.kind, 'pay');
  assert.equal(payload.items[0].itemId, 'benches');
  assert.equal(payload.items[0].qty, 1);
  assert.equal(JSON.stringify(payload).includes('4242'), false);
});

test('cart stores quantity only and totals in TTD', () => {
  const storage = pay.memoryStorage();
  pay.addToCart(storage, 'tiles', 2);
  pay.addToCart(storage, 'benches', 1);
  pay.addToCart(storage, 'tiles', 1);
  pay.addToCart(storage, 'consult', 4);
  const saved = JSON.parse(storage.getItem('glastic-cart'));
  assert.deepEqual(saved, [
    { id: 'tiles', qty: 3 },
    { id: 'benches', qty: 1 }
  ]);
  assert.equal(JSON.stringify(saved).includes('4242'), false);
  assert.equal(pay.cartCount(saved), 4);
  assert.equal(pay.cartSubtotal(saved), 25 * 3 + 250);
  const lines = pay.cartLines(saved);
  const payload = pay.buildCheckoutPayload({
    source: 'cart',
    mode: 'pay',
    orderId: 'GD-261102-TEST',
    lines
  });
  assert.equal(payload.amount, 325);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0].lineTotal, 75);
  pay.changeQty(storage, 'benches', 2);
  pay.removeFromCart(storage, 'tiles');
  assert.deepEqual(pay.loadCart(storage), [{ id: 'benches', qty: 2 }]);
  assert.equal(pay.cartSubtotal(pay.loadCart(storage)), 500);
});

test('card fields are rejected if someone adds them to the payload', () => {
  const payload = pay.buildCheckoutPayload(sessionFor('tiles', 'deposit'));
  payload.cvc = '123';
  assert.throws(() => pay.assertNoCardPayload(payload), /Card details/);
  assert.throws(() => pay.providers.demo.createCheckout(payload), /Card details/);
});

test('demo provider confirms without calling fetch', async () => {
  let called = false;
  global.fetch = () => {
    called = true;
    throw new Error('fetch should not run');
  };
  const payload = pay.buildCheckoutPayload(sessionFor('consult', 'deposit'));
  const result = await pay.providers.demo.createCheckout(payload);
  assert.equal(called, false);
  assert.equal(result.status, 'demo-confirmed');
  assert.equal(result.reference, payload.orderId);
  assert.equal(payload.amount, 150);
});

test('wipay request body has no card fields', async () => {
  let sent = null;
  global.fetch = async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ url: 'https://tt.wipayfinancial.com/checkout/example' }) };
  };
  const payload = pay.buildCheckoutPayload(sessionFor('shelves', 'deposit'));
  const result = await pay.providers.wipay.createCheckout(payload);
  assert.equal(sent.url, '/api/checkout');
  assert.deepEqual(Object.keys(sent.body).sort(), [
    'amount', 'currency', 'description', 'items', 'kind', 'orderId', 'provider'
  ]);
  assert.equal(sent.body.provider, 'wipay');
  assert.equal(sent.body.amount, 150);
  assert.equal(result.status, 'redirect');
  assert.equal(result.redirectUrl, 'https://tt.wipayfinancial.com/checkout/example');
});

test('card validation accepts a complete demo card and rejects empties', () => {
  const good = {
    name: 'Demo Customer',
    number: '4242 4242 4242 4242',
    expiry: '12/28',
    cvc: '123'
  };
  assert.equal(pay.validateCardFields(good, NOW), null);
  assert.equal(pay.validateCardFields({ ...good, name: 'A' }, NOW).field, 'pay-name');
  assert.equal(pay.validateCardFields({ ...good, number: '4242' }, NOW).field, 'pay-number');
  assert.equal(pay.validateCardFields({ ...good, expiry: '10/26' }, NOW).field, 'pay-expiry');
  assert.equal(pay.validateCardFields({ ...good, cvc: '12' }, NOW).field, 'pay-cvc');
  assert.equal(pay.validateCardFields(good, NOW), null);
});

test('order ids do not depend on card data', () => {
  const id = pay.createOrderId(NOW);
  assert.match(id, /^GD-261102-[A-Z0-9]+$/);
});
