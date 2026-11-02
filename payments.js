/**
 * Glastic Designs — sample checkout.
 *
 * Active provider is "demo". Card fields never leave the page: they have no
 * name attributes, are not written to storage, and are not placed on any
 * request. They are cleared as soon as a demo payment is confirmed.
 *
 * Plug in WiPay (Trinidad and Tobago) later without putting card data on
 * our server:
 *   1. Set window.GLASTIC_PAYMENT_PROVIDER = 'wipay' before this script.
 *   2. Deploy POST /api/checkout (override with window.GLASTIC_PAYMENTS.checkoutApi).
 *      Body: { provider, orderId, amount, currency, description, itemId, kind }
 *      The route must reject any card, pan, cvc, or expiry field.
 *   3. On the server, POST the order (not card data) to WiPay:
 *      https://tt.wipayfinancial.com/plugins/payments/request
 *      Keep the merchant account number in an environment variable.
 *      Typical fields: account_number, country_code=TT, currency=TTD,
 *      fee_structure, method=credit_card, order_id, origin, total, response_url.
 *   4. Return { url } from /api/checkout. This file redirects the browser
 *      there. The customer enters their card on WiPay, not on this site.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GlasticPay = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { api.mount(); });
    } else {
      api.mount();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var CATALOG = {
    tiles: {
      id: 'tiles',
      name: 'Plastic Tiles',
      summary: '4 × 7 7/8" square tiles',
      pay: 100,
      deposit: 50
    },
    benches: {
      id: 'benches',
      name: 'Bench or Stool',
      summary: 'One bench or circular stool',
      pay: 250,
      deposit: 125
    },
    shelves: {
      id: 'shelves',
      name: 'Shelf or Furniture',
      summary: 'One shelf, console, or table',
      pay: 300,
      deposit: 150
    },
    coasters: {
      id: 'coasters',
      name: 'Coasters & Clock',
      summary: 'Gift set at a sample price',
      pay: 80,
      deposit: 40
    },
    awards: {
      id: 'awards',
      name: 'Custom Award',
      summary: 'Event or corporate gift',
      pay: null,
      deposit: 200
    },
    school: {
      id: 'school',
      name: 'School Furniture Refurb',
      summary: 'Partnership consultation',
      pay: null,
      deposit: 150
    },
    consult: {
      id: 'consult',
      name: 'Design Consultation',
      summary: 'Studio or site visit, Port of Spain',
      pay: null,
      deposit: 150
    }
  };

  var CARD_KEYS = {
    pan: true,
    card: true,
    cardnumber: true,
    cardnum: true,
    number: true,
    cvc: true,
    cvv: true,
    cvc2: true,
    expiry: true,
    exp: true,
    expiration: true,
    nameoncard: true,
    securitycode: true
  };

  function formatTTD(amount) {
    var n = Number(amount);
    if (!Number.isFinite(n)) throw new Error('Invalid amount');
    return '$' + n.toFixed(2) + ' TTD';
  }

  function resolveMode(item, mode) {
    if (!item || item.pay == null || mode === 'deposit') return 'deposit';
    return 'pay';
  }

  function amountFor(item, mode) {
    return resolveMode(item, mode) === 'pay' ? item.pay : item.deposit;
  }

  function createOrderId(now) {
    var date = now || new Date();
    var y = String(date.getFullYear()).slice(2);
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'GD-' + y + m + d + '-' + rand;
  }

  function assertNoCardPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid checkout.');
    }
    Object.keys(payload).forEach(function (key) {
      var normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (CARD_KEYS[normalized]) {
        throw new Error('Card details cannot be included in checkout.');
      }
    });
  }

  function buildCheckoutPayload(session) {
    var payload = {
      provider: getProvider().id,
      orderId: session.orderId,
      itemId: session.item.id,
      itemName: session.item.name,
      summary: session.item.summary,
      kind: session.mode,
      currency: 'TTD',
      amount: session.amount,
      description: session.item.name + ' — ' + (session.mode === 'deposit' ? 'deposit' : 'payment')
    };
    assertNoCardPayload(payload);
    return payload;
  }

  function validateCardFields(fields, now) {
    var clock = now || new Date();
    var name = fields && fields.name ? String(fields.name).trim() : '';
    if (name.length < 2) return { message: 'Enter the name on the card.', field: 'pay-name' };

    var digits = fields && fields.number ? String(fields.number).replace(/\D/g, '') : '';
    if (digits.length < 13 || digits.length > 19) {
      return { message: 'Enter a card number (13–19 digits).', field: 'pay-number' };
    }

    var expiry = fields && fields.expiry ? String(fields.expiry).trim() : '';
    var match = /^(\d{2})\/(\d{2})$/.exec(expiry);
    if (!match) return { message: 'Enter an expiry date as MM/YY.', field: 'pay-expiry' };
    var month = Number(match[1]);
    var year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return { message: 'Enter a valid expiry month.', field: 'pay-expiry' };
    var end = new Date(year, month, 1);
    if (clock >= end) return { message: 'Enter an expiry date in the future.', field: 'pay-expiry' };

    var cvc = fields && fields.cvc ? String(fields.cvc).replace(/\D/g, '') : '';
    if (cvc.length < 3 || cvc.length > 4) {
      return { message: 'Enter the 3- or 4-digit security code.', field: 'pay-cvc' };
    }
    return null;
  }

  function checkoutApi() {
    if (typeof window !== 'undefined' && window.GLASTIC_PAYMENTS && window.GLASTIC_PAYMENTS.checkoutApi) {
      return window.GLASTIC_PAYMENTS.checkoutApi;
    }
    return '/api/checkout';
  }

  var providers = {
    demo: {
      id: 'demo',
      label: 'Demo checkout',
      createCheckout: function (order) {
        assertNoCardPayload(order);
        return Promise.resolve({ status: 'demo-confirmed', reference: order.orderId });
      }
    },
    wipay: {
      id: 'wipay',
      label: 'WiPay',
      createCheckout: function (order) {
        assertNoCardPayload(order);
        return fetch(checkoutApi(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            provider: 'wipay',
            orderId: order.orderId,
            amount: order.amount,
            currency: order.currency,
            description: order.description,
            itemId: order.itemId,
            kind: order.kind
          })
        }).then(function (res) {
          if (!res.ok) throw new Error('WiPay is not connected yet.');
          return res.json();
        }).then(function (data) {
          if (!data || typeof data.url !== 'string') throw new Error('WiPay did not return a checkout URL.');
          return { status: 'redirect', redirectUrl: data.url, reference: order.orderId };
        });
      }
    }
  };

  function getProvider(id) {
    var chosen = id;
    if (!chosen && typeof window !== 'undefined') chosen = window.GLASTIC_PAYMENT_PROVIDER;
    if (!chosen) chosen = 'demo';
    var provider = providers[chosen];
    if (!provider) throw new Error('Unknown payment provider.');
    return provider;
  }

  var session = null;
  var lastFocus = null;

  function el(id) { return document.getElementById(id); }

  function clearFields() {
    ['pay-name', 'pay-number', 'pay-expiry', 'pay-cvc'].forEach(function (id) {
      var input = el(id);
      if (input) input.value = '';
    });
  }

  function showError(message) {
    var box = el('pay-error');
    if (!box) return;
    box.textContent = message || '';
    box.classList.toggle('hidden', !message);
  }

  function kindLabel(mode) {
    return mode === 'deposit' ? 'Deposit' : 'Pay in full';
  }

  function renderSummary() {
    if (!session) return;
    el('pay-item-name').textContent = session.item.name;
    el('pay-item-summary').textContent = session.item.summary;
    el('pay-kind').textContent = kindLabel(session.mode);
    el('pay-order-id').textContent = session.orderId;
    el('pay-amount').textContent = formatTTD(session.amount);
    var provider = getProvider();
    var demo = provider.id === 'demo';
    el('pay-card-block').classList.toggle('hidden', !demo);
    el('pay-wipay-block').classList.toggle('hidden', demo);
    el('pay-submit-label').textContent = demo
      ? ((session.mode === 'deposit' ? 'Pay Deposit ' : 'Pay ') + formatTTD(session.amount))
      : 'Continue to WiPay';
    var note = el('pay-provider-note');
    if (note) {
      note.textContent = demo
        ? 'Demo only. Any 16-digit number works — nothing is charged or sent. WiPay can replace this later.'
        : 'You will continue to WiPay to pay. Card details are entered on WiPay, not here.';
    }
  }

  function showFormView() {
    el('pay-view-form').classList.remove('hidden');
    el('pay-view-success').classList.add('hidden');
    el('pay-view-form').removeAttribute('aria-hidden');
    el('pay-view-success').setAttribute('aria-hidden', 'true');
  }

  function showSuccess(order) {
    el('pay-ref').textContent = order.orderId;
    el('pay-success-item').textContent = order.itemName;
    el('pay-success-summary').textContent = order.summary;
    el('pay-success-kind').textContent = kindLabel(order.kind);
    el('pay-success-amount').textContent = formatTTD(order.amount);
    var text = 'Hi Glastic Designs, I tried the sample checkout for ' + order.itemName +
      ' (' + order.orderId + ', ' + formatTTD(order.amount) + ').';
    el('pay-whatsapp').href = 'https://wa.me/18687752407?text=' + encodeURIComponent(text);
    el('pay-view-form').classList.add('hidden');
    el('pay-view-success').classList.remove('hidden');
    el('pay-view-form').setAttribute('aria-hidden', 'true');
    el('pay-view-success').removeAttribute('aria-hidden');
    var done = el('pay-done');
    if (done) done.focus();
  }

  function open(itemId, mode) {
    var item = CATALOG[itemId];
    if (!item) return;
    var resolved = resolveMode(item, mode);
    session = {
      item: item,
      mode: resolved,
      amount: amountFor(item, resolved),
      orderId: createOrderId()
    };
    clearFields();
    showError('');
    showFormView();
    renderSummary();
    var overlay = el('pay-checkout');
    lastFocus = document.activeElement;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    overlay.focus();
  }

  function close() {
    var overlay = el('pay-checkout');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearFields();
    showError('');
    session = null;
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (e) { /* ignore */ }
    }
  }

  function readFields() {
    return {
      name: el('pay-name').value,
      number: el('pay-number').value,
      expiry: el('pay-expiry').value,
      cvc: el('pay-cvc').value
    };
  }

  function onSubmit(event) {
    if (event) event.preventDefault();
    if (!session) return;
    var provider = getProvider();
    if (provider.id !== 'demo') {
      clearFields();
      var orderOnly = buildCheckoutPayload(session);
      provider.createCheckout(orderOnly).then(function (result) {
        if (result.status === 'redirect' && result.redirectUrl) {
          window.location.assign(result.redirectUrl);
        }
      }).catch(function (err) {
        showError(err && err.message ? err.message : 'Checkout could not start.');
      });
      return;
    }

    var fields = readFields();
    var problem = validateCardFields(fields);
    fields.name = '';
    fields.number = '';
    fields.expiry = '';
    fields.cvc = '';
    if (problem) {
      showError(problem.message);
      var invalid = el(problem.field);
      if (invalid) invalid.focus();
      return;
    }
    clearFields();
    var order = buildCheckoutPayload(session);
    var button = el('pay-submit');
    if (button) button.disabled = true;
    provider.createCheckout(order).then(function (result) {
      if (result.status === 'redirect' && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      showSuccess(order);
    }).catch(function (err) {
      showError(err && err.message ? err.message : 'Checkout could not start.');
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function fillDemoCard() {
    el('pay-name').value = 'Demo Customer';
    el('pay-number').value = '4242 4242 4242 4242';
    el('pay-expiry').value = '12/28';
    el('pay-cvc').value = '123';
    showError('');
  }

  function bindFormatters() {
    var number = el('pay-number');
    number.addEventListener('input', function () {
      var digits = number.value.replace(/\D/g, '').slice(0, 19);
      number.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    });
    var expiry = el('pay-expiry');
    expiry.addEventListener('input', function () {
      var digits = expiry.value.replace(/\D/g, '').slice(0, 4);
      expiry.value = digits.length >= 3 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    });
    var cvc = el('pay-cvc');
    cvc.addEventListener('input', function () {
      cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  function syncLabels() {
    document.querySelectorAll('[data-pay-amount]').forEach(function (node) {
      var item = CATALOG[node.getAttribute('data-pay-amount')];
      if (!item) return;
      node.textContent = formatTTD(amountFor(item, node.getAttribute('data-pay-mode') || 'deposit'));
    });
  }

  function mount() {
    var overlay = el('pay-checkout');
    if (!overlay || overlay.dataset.bound === 'true') return;
    overlay.dataset.bound = 'true';
    syncLabels();
    bindFormatters();

    document.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-pay-open]');
      if (opener) {
        event.preventDefault();
        event.stopPropagation();
        open(opener.getAttribute('data-pay-open'), opener.getAttribute('data-pay-mode') || 'pay');
        return;
      }
      if (event.target.closest('[data-pay-close]')) {
        event.preventDefault();
        close();
        return;
      }
      if (event.target.closest('[data-pay-demo-card]')) {
        event.preventDefault();
        fillDemoCard();
      }
    });

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });

    el('pay-submit').addEventListener('click', onSubmit);
    el('pay-form').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') onSubmit(event);
    });

    window.addEventListener('pagehide', clearFields);
  }

  return {
    CATALOG: CATALOG,
    formatTTD: formatTTD,
    resolveMode: resolveMode,
    amountFor: amountFor,
    createOrderId: createOrderId,
    assertNoCardPayload: assertNoCardPayload,
    buildCheckoutPayload: buildCheckoutPayload,
    validateCardFields: validateCardFields,
    providers: providers,
    getProvider: getProvider,
    open: open,
    close: close,
    mount: mount
  };
});
