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
      summary: '7 7/8" square tile',
      unit: 25,
      pay: 100,
      deposit: 50
    },
    benches: {
      id: 'benches',
      name: 'Bench or Stool',
      summary: 'One bench or circular stool',
      unit: 250,
      pay: 250,
      deposit: 125
    },
    shelves: {
      id: 'shelves',
      name: 'Shelf or Furniture',
      summary: 'One shelf, console, or table',
      unit: 300,
      pay: 300,
      deposit: 150
    },
    coasters: {
      id: 'coasters',
      name: 'Coasters & Clock',
      summary: 'Gift set at a sample price',
      unit: 80,
      pay: 80,
      deposit: 40
    },
    awards: {
      id: 'awards',
      name: 'Custom Award',
      summary: 'Event or corporate gift',
      unit: 200,
      pay: null,
      deposit: 200
    },
    school: {
      id: 'school',
      name: 'School Furniture Refurb',
      summary: 'Partnership consultation',
      unit: 150,
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

  var CART_KEY = 'glastic-cart';

  function clampQty(value) {
    var qty = Math.round(Number(value));
    if (!Number.isFinite(qty) || qty < 1) return 1;
    if (qty > 99) return 99;
    return qty;
  }

  function memoryStorage() {
    var data = {};
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
      setItem: function (key, value) { data[key] = String(value); }
    };
  }

  function storageOr(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* private mode */ }
    return memoryStorage();
  }

  function normalizeCart(rows) {
    if (!Array.isArray(rows)) return [];
    var merged = {};
    var order = [];
    rows.forEach(function (row) {
      if (!row || !CATALOG[row.id] || CATALOG[row.id].unit == null) return;
      var qty = clampQty(row.qty);
      if (!merged[row.id]) order.push(row.id);
      merged[row.id] = (merged[row.id] || 0) + qty;
      if (merged[row.id] > 99) merged[row.id] = 99;
    });
    return order.map(function (id) { return { id: id, qty: merged[id] }; });
  }

  function loadCart(storage) {
    var store = storageOr(storage);
    try {
      return normalizeCart(JSON.parse(store.getItem(CART_KEY) || '[]'));
    } catch (e) {
      return [];
    }
  }

  function saveCart(storage, rows) {
    var clean = normalizeCart(rows).map(function (row) { return { id: row.id, qty: row.qty }; });
    storageOr(storage).setItem(CART_KEY, JSON.stringify(clean));
    return clean;
  }

  function addToCart(storage, id, qty) {
    var rows = loadCart(storage);
    var found = false;
    rows.forEach(function (row) {
      if (row.id === id) {
        row.qty = clampQty(row.qty + clampQty(qty));
        found = true;
      }
    });
    if (!found) rows.push({ id: id, qty: clampQty(qty) });
    return saveCart(storage, rows);
  }

  function changeQty(storage, id, qty) {
    var next = clampQty(qty);
    var rows = loadCart(storage).map(function (row) {
      return row.id === id ? { id: id, qty: next } : row;
    });
    return saveCart(storage, rows);
  }

  function removeFromCart(storage, id) {
    return saveCart(storage, loadCart(storage).filter(function (row) { return row.id !== id; }));
  }

  function cartLines(rows) {
    return normalizeCart(rows).map(function (row) {
      var item = CATALOG[row.id];
      return {
        itemId: item.id,
        itemName: item.name,
        summary: item.summary,
        qty: row.qty,
        unitPrice: item.unit,
        lineTotal: item.unit * row.qty
      };
    });
  }

  function cartSubtotal(rows) {
    return cartLines(rows).reduce(function (sum, line) { return sum + line.lineTotal; }, 0);
  }

  function cartCount(rows) {
    return normalizeCart(rows).reduce(function (sum, row) { return sum + row.qty; }, 0);
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
    if (!payload || typeof payload !== 'object') throw new Error('Invalid checkout.');
    walkPayload(payload);
  }

  function walkPayload(value) {
    if (Array.isArray(value)) {
      value.forEach(walkPayload);
      return;
    }
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(function (key) {
      var normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (CARD_KEYS[normalized]) throw new Error('Card details cannot be included in checkout.');
      walkPayload(value[key]);
    });
  }

  function sessionLines(session) {
    if (session.lines && session.lines.length) return session.lines;
    return [{
      itemId: session.item.id,
      itemName: session.item.name,
      summary: session.item.summary,
      qty: 1,
      unitPrice: session.amount,
      lineTotal: session.amount
    }];
  }

  function buildCheckoutPayload(session) {
    var lines = sessionLines(session);
    var amount = lines.reduce(function (sum, line) { return sum + line.lineTotal; }, 0);
    var description = lines.length === 1
      ? lines[0].itemName + ' — ' + (session.mode === 'deposit' ? 'deposit' : 'payment')
      : 'Cart · ' + lines.length + ' items';
    var payload = {
      provider: getProvider().id,
      orderId: session.orderId,
      kind: session.mode,
      currency: 'TTD',
      amount: amount,
      description: description,
      items: lines.map(function (line) {
        return {
          itemId: line.itemId,
          itemName: line.itemName,
          summary: line.summary,
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal
        };
      })
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
            kind: order.kind,
            items: order.items
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

  function fillLineList(container, lines) {
    if (!container) return;
    container.textContent = '';
    lines.forEach(function (line) {
      var row = document.createElement('div');
      row.className = 'flex justify-between gap-3 py-1';
      var name = document.createElement('span');
      name.className = 'text-stone-700';
      name.textContent = line.qty + ' × ' + line.itemName;
      var total = document.createElement('span');
      total.className = 'font-semibold text-right';
      total.textContent = formatTTD(line.lineTotal);
      row.appendChild(name);
      row.appendChild(total);
      container.appendChild(row);
    });
  }

  function renderSummary() {
    if (!session) return;
    var lines = sessionLines(session);
    var amount = lines.reduce(function (sum, line) { return sum + line.lineTotal; }, 0);
    var title = lines.length === 1 ? lines[0].itemName : 'Your order';
    var detail = lines.length === 1 ? lines[0].summary : lines.length + ' items';
    el('pay-item-name').textContent = title;
    el('pay-item-summary').textContent = detail;
    el('pay-kind').textContent = kindLabel(session.mode);
    el('pay-order-id').textContent = session.orderId;
    el('pay-amount').textContent = formatTTD(amount);
    fillLineList(el('pay-lines'), lines);
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
    var lines = order.items || [];
    var label = lines.length === 1 ? lines[0].itemName : lines.length + ' items';
    el('pay-ref').textContent = order.orderId;
    el('pay-success-item').textContent = label;
    el('pay-success-summary').textContent = order.description;
    el('pay-success-kind').textContent = kindLabel(order.kind);
    el('pay-success-amount').textContent = formatTTD(order.amount);
    fillLineList(el('pay-success-lines'), lines);
    if (session && session.source === 'cart') {
      saveCart(null, []);
      renderCart();
    }
    var text = 'Hi Glastic Designs, I tried the sample checkout for ' + label +
      ' (' + order.orderId + ', ' + formatTTD(order.amount) + ').';
    el('pay-whatsapp').href = 'https://wa.me/18687752407?text=' + encodeURIComponent(text);
    el('pay-view-form').classList.add('hidden');
    el('pay-view-success').classList.remove('hidden');
    el('pay-view-form').setAttribute('aria-hidden', 'true');
    el('pay-view-success').removeAttribute('aria-hidden');
    var done = el('pay-done');
    if (done) done.focus();
  }

  function renderCart() {
    var rows = loadCart();
    var count = cartCount(rows);
    var lines = cartLines(rows);
    var badge = el('cart-count');
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('is-on', count > 0);
    }
    var opener = el('cart-open');
    if (opener) {
      opener.setAttribute('aria-label', 'Open cart, ' + count + (count === 1 ? ' item' : ' items'));
    }
    var list = el('cart-lines');
    var empty = el('cart-empty');
    var footer = el('cart-footer');
    if (!list) return;
    list.textContent = '';
    if (empty) empty.classList.toggle('hidden', lines.length > 0);
    if (footer) footer.classList.toggle('hidden', lines.length === 0);
    lines.forEach(function (line) {
      var article = document.createElement('article');
      article.className = 'cart-line';
      var info = document.createElement('div');
      var name = document.createElement('p');
      name.className = 'font-semibold text-stone-900';
      name.textContent = line.itemName;
      var meta = document.createElement('p');
      meta.className = 'text-sm text-stone-500';
      meta.textContent = formatTTD(line.unitPrice) + ' each';
      info.appendChild(name);
      info.appendChild(meta);
      var side = document.createElement('div');
      side.className = 'text-right';
      var lineTotal = document.createElement('p');
      lineTotal.className = 'font-semibold text-emerald-800';
      lineTotal.textContent = formatTTD(line.lineTotal);
      var controls = document.createElement('div');
      controls.className = 'qty-stepper qty-stepper-sm mt-2';
      controls.setAttribute('data-cart-control', '');
      var minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'qty-btn';
      minus.setAttribute('data-cart-delta', '-1');
      minus.setAttribute('data-cart-id', line.itemId);
      minus.setAttribute('aria-label', 'Decrease ' + line.itemName);
      minus.textContent = '−';
      var qty = document.createElement('span');
      qty.className = 'qty-readout';
      qty.textContent = String(line.qty);
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'qty-btn';
      plus.setAttribute('data-cart-delta', '1');
      plus.setAttribute('data-cart-id', line.itemId);
      plus.setAttribute('aria-label', 'Increase ' + line.itemName);
      plus.textContent = '+';
      controls.appendChild(minus);
      controls.appendChild(qty);
      controls.appendChild(plus);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cart-remove';
      remove.setAttribute('data-cart-remove', line.itemId);
      remove.textContent = 'Remove';
      side.appendChild(lineTotal);
      side.appendChild(controls);
      side.appendChild(remove);
      article.appendChild(info);
      article.appendChild(side);
      list.appendChild(article);
    });
    var sub = el('cart-subtotal');
    if (sub) sub.textContent = formatTTD(cartSubtotal(rows));
  }

  function openCart() {
    var drawer = el('cart-drawer');
    if (!drawer) return;
    renderCart();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    var drawer = el('cart-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (!el('pay-checkout').classList.contains('is-open')) document.body.style.overflow = '';
  }

  function checkoutCart() {
    var lines = cartLines(loadCart());
    if (!lines.length) return;
    session = {
      source: 'cart',
      mode: 'pay',
      lines: lines,
      amount: lines.reduce(function (sum, line) { return sum + line.lineTotal; }, 0),
      orderId: createOrderId()
    };
    closeCart();
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

  function readQty(control) {
    var input = control.querySelector('.qty-input');
    return clampQty(input ? input.value : 1);
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

  function adoptCatalog(products) {
    if (!Array.isArray(products)) return;
    Object.keys(CATALOG).forEach(function (key) { delete CATALOG[key]; });
    products.forEach(function (product) {
      if (!product || product.hidden) return;
      var price = Number(product.priceTtd);
      if (!product.id || !Number.isFinite(price)) return;
      CATALOG[product.id] = {
        id: product.id,
        name: product.name,
        summary: product.description || '',
        unit: price,
        pay: price,
        deposit: null
      };
    });
    if (typeof document !== 'undefined' && document.getElementById('cart-count')) renderCart();
  }

  function mount() {
    var overlay = el('pay-checkout');
    if (!overlay || overlay.dataset.bound === 'true') return;
    overlay.dataset.bound = 'true';
    syncLabels();
    bindFormatters();

    document.addEventListener('click', function (event) {
      var cartControl = event.target.closest('[data-cart-control]');
      if (cartControl && !event.target.closest('#cart-drawer')) {
        event.stopPropagation();
      }
      var add = event.target.closest('[data-cart-add]');
      if (add) {
        event.preventDefault();
        event.stopPropagation();
        var group = add.closest('[data-cart-control]') || add.parentNode;
        addToCart(null, add.getAttribute('data-cart-add'), readQty(group));
        renderCart();
        var previous = add.textContent;
        add.textContent = 'Added';
        window.setTimeout(function () { add.textContent = previous === 'Added' ? 'Add to Cart' : previous; }, 900);
        return;
      }
      var deltaBtn = event.target.closest('[data-cart-delta]');
      if (deltaBtn && deltaBtn.closest('#cart-drawer')) {
        event.preventDefault();
        var id = deltaBtn.getAttribute('data-cart-id');
        var current = loadCart().filter(function (row) { return row.id === id; })[0];
        var nextQty = (current ? current.qty : 1) + Number(deltaBtn.getAttribute('data-cart-delta'));
        if (nextQty < 1) removeFromCart(null, id);
        else changeQty(null, id, nextQty);
        renderCart();
        return;
      }
      var step = event.target.closest('[data-qty-delta]');
      if (step) {
        event.preventDefault();
        event.stopPropagation();
        var wrap = step.closest('[data-cart-control]');
        var input = wrap && wrap.querySelector('.qty-input');
        if (input) input.value = String(clampQty(Number(input.value) + Number(step.getAttribute('data-qty-delta'))));
        return;
      }
      var removeBtn = event.target.closest('[data-cart-remove]');
      if (removeBtn) {
        event.preventDefault();
        removeFromCart(null, removeBtn.getAttribute('data-cart-remove'));
        renderCart();
        return;
      }
      if (event.target.closest('#cart-open')) {
        event.preventDefault();
        openCart();
        return;
      }
      if (event.target.closest('[data-cart-close]')) {
        event.preventDefault();
        closeCart();
        return;
      }
      if (event.target.closest('[data-cart-checkout]')) {
        event.preventDefault();
        checkoutCart();
        return;
      }
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
      if (event.key !== 'Escape') return;
      if (overlay.classList.contains('is-open')) close();
      else if (el('cart-drawer') && el('cart-drawer').classList.contains('is-open')) closeCart();
    });
    var drawer = el('cart-drawer');
    if (drawer) {
      drawer.addEventListener('click', function (event) {
        if (event.target === drawer) closeCart();
      });
    }
    renderCart();

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
    mount: mount,
    adoptCatalog: adoptCatalog,
    memoryStorage: memoryStorage,
    loadCart: loadCart,
    saveCart: saveCart,
    addToCart: addToCart,
    changeQty: changeQty,
    removeFromCart: removeFromCart,
    cartLines: cartLines,
    cartSubtotal: cartSubtotal,
    cartCount: cartCount,
    clampQty: clampQty
  };
});
