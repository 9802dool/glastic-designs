(function () {
  var CATEGORIES = ['Tiles', 'Planters', 'Furniture', 'Gifts', 'Services'];
  var THEME_CARDS = [
    { id: 'forest', label: 'Forest green', colors: ['#064e3b', '#065f46', '#0f766e'] },
    { id: 'ocean', label: 'Ocean teal', colors: ['#155e75', '#0e7490', '#0891b2'] },
    { id: 'sunset', label: 'Warm sunset', colors: ['#9a3412', '#c2410c', '#ea580c'] },
    { id: 'slate', label: 'Slate & sage', colors: ['#334155', '#475569', '#059669'] }
  ];
  var PREV_THEME_KEY = 'glastic-admin-previous-theme';

  var app = document.getElementById('app');
  var titleEl = document.getElementById('title');
  var navBack = document.getElementById('nav-back');
  var signOut = document.getElementById('sign-out');
  var footerBar = document.getElementById('footer-bar');
  var footerInner = document.getElementById('footer-inner');
  var products = [];
  var settingsCache = null;
  var backHandler = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function money(value) {
    return '$' + Number(value).toFixed(2) + ' TT$';
  }

  function friendlyError(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return "That didn't save – check your internet and try again.";
    }
    var msg = err && err.message;
    if (msg && msg.length < 120) return "That didn't save – " + msg;
    return "That didn't save – check your internet and try again.";
  }

  async function api(url, options) {
    var res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, options || {}));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw Object.assign(new Error(data.error || friendlyError(null)), data);
    return data;
  }

  function mainPhoto(product) {
    var photos = product.photos || [];
    return photos.find(function (p) { return p.isMain; }) || photos[0];
  }

  function setHeader(title, showBack, onBack) {
    titleEl.textContent = title;
    navBack.hidden = !showBack;
    backHandler = onBack || null;
  }

  function setFooter(html) {
    if (!html) {
      footerBar.hidden = true;
      footerInner.innerHTML = '';
      document.body.classList.remove('has-footer');
      return;
    }
    footerBar.hidden = false;
    footerInner.innerHTML = html;
    document.body.classList.add('has-footer');
  }

  function showLoading(message) {
    setFooter(null);
    app.innerHTML = '<div class="loading" role="status"><div class="spinner" aria-hidden="true"></div><span>'
      + esc(message || 'Loading…') + '</span></div>';
  }

  function errBlock(id) {
    return '<p id="' + id + '" class="alert alert-error" hidden role="alert"></p>';
  }

  navBack.onclick = function () {
    if (backHandler) backHandler();
  };

  function renderDone(seeUrl, seeLabel) {
    setHeader('All set', true, showMenu);
    setFooter(
      '<div class="stack">'
      + '<a class="btn-primary" style="text-decoration:none" href="' + esc(seeUrl || '/') + '" target="_blank" rel="noopener">' + esc(seeLabel || 'See it') + '</a>'
      + '<button type="button" class="btn-secondary" id="menu-btn">Back to menu</button>'
      + '</div>'
    );
    app.innerHTML = '<div class="done-screen">'
      + '<div class="done-icon" aria-hidden="true"><i class="fas fa-check"></i></div>'
      + '<h2>Done – it\'s on your website</h2>'
      + '<p class="muted">Shoppers can see the change right away.</p>'
      + '</div>';
    document.getElementById('menu-btn').onclick = showMenu;
  }

  function compress(file) {
    return createImageBitmap(file).then(function (bitmap) {
      var max = 1200;
      var scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close && bitmap.close();
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) reject(new Error('Could not read that photo.'));
          else resolve(blob);
        }, 'image/jpeg', 0.82);
      });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function loadProducts() {
    var data = await api('/api/admin/products');
    products = data.products || [];
    return products;
  }

  async function loadSettings() {
    var data = await api('/api/admin/settings');
    settingsCache = data.settings;
    return data;
  }

  function rememberThemeBeforeChange() {
    if (!settingsCache || !settingsCache.theme) return;
    try {
      localStorage.setItem(PREV_THEME_KEY, JSON.stringify(settingsCache.theme));
    } catch (e) { /* ignore */ }
  }

  function showMenu() {
    setHeader('Your shop', false, null);
    signOut.hidden = false;
    setFooter(null);
    app.innerHTML = '<h2 class="page-title">What would you like to do?</h2>'
      + '<p class="lead">Tap a task below. Changes go live as soon as you save.</p>'
      + '<ul class="menu-list">'
      + menuItem('add', 'fa-plus', 'Add a new product', 'Photo, name, price, and group')
      + menuItem('price', 'fa-tag', 'Change a price', 'Pick a product and update TT$')
      + menuItem('photos', 'fa-camera', 'Change or add photos', 'Replace the main product photo')
      + menuItem('hide', 'fa-eye-slash', 'Sold out? Hide or show', 'Hide items you don\'t have now')
      + menuItem('words', 'fa-pen', 'Change my homepage words', 'Headline, intro, and about text')
      + menuItem('colours', 'fa-palette', 'Change my colours', 'Choose one of four site looks')
      + '</ul>'
      + '<a class="btn-primary" style="display:block;text-align:center;text-decoration:none;margin-top:var(--space-4)" href="/admin/edit.html">Edit my website (tap anything)</a>'
      + '<p class="muted" style="text-align:center;font-size:0.875rem;margin-top:0.5rem">Full-screen tap-to-edit on your live pages</p>'
      + '<a class="btn-ghost-link" href="/admin/advanced.html">More settings (for your developer)</a>';
    bindMenu();
  }

  function menuItem(id, icon, label, sub) {
    return '<li><button type="button" class="menu-btn" data-go="' + esc(id) + '">'
      + '<span class="icon"><i class="fas ' + icon + '" aria-hidden="true"></i></span>'
      + '<span><span class="label">' + esc(label) + '</span><span class="sub">' + esc(sub) + '</span></span>'
      + '</button></li>';
  }

  function bindMenu() {
    app.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.onclick = function () {
        var job = btn.getAttribute('data-go');
        if (job === 'add') startAddProduct();
        else if (job === 'price') pickProduct('price');
        else if (job === 'photos') pickProduct('photos');
        else if (job === 'hide') pickProduct('hide');
        else if (job === 'words') editWords();
        else if (job === 'colours') editColours();
      };
    });
  }

  function productPickList(action) {
    if (!products.length) {
      return '<div class="empty-state"><p>No products yet. Add your first product from the menu.</p>'
        + '<button type="button" class="btn-secondary" id="empty-add">Add a new product</button></div>';
    }
    return '<div class="pick-list">' + products.map(function (p) {
      var photo = mainPhoto(p);
      var img = photo
        ? '<img src="' + esc(photo.url) + '" alt="">'
        : '<div class="ph"></div>';
      var hidden = p.hidden ? ' · Hidden' : '';
      return '<button type="button" class="pick" data-pick="' + esc(p.id) + '" data-action="' + esc(action) + '">'
        + img
        + '<span class="meta"><strong>' + esc(p.name) + '</strong><span class="price">' + money(p.priceTtd) + hidden + '</span></span>'
        + '<i class="fas fa-chevron-right chev" aria-hidden="true"></i></button>';
    }).join('') + '</div>';
  }

  async function pickProduct(action) {
    var titles = { price: 'Change a price', photos: 'Change photos', hide: 'Hide or show' };
    setHeader(titles[action] || 'Choose product', true, showMenu);
    showLoading('Loading products…');
    try {
      await loadProducts();
    } catch (e) {
      app.innerHTML = '<p class="alert alert-error">' + esc(friendlyError(e)) + '</p>';
      setFooter('<button type="button" class="btn-secondary" id="retry-btn">Try again</button>');
      document.getElementById('retry-btn').onclick = function () { pickProduct(action); };
      return;
    }
    setFooter(null);
    app.innerHTML = '<h2 class="page-title">' + esc(titles[action]) + '</h2>'
      + '<p class="lead">Tap the product you mean.</p>'
      + productPickList(action);
    var emptyAdd = document.getElementById('empty-add');
    if (emptyAdd) emptyAdd.onclick = startAddProduct;
    app.querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-pick');
        var act = btn.getAttribute('data-action');
        if (act === 'price') editPrice(id);
        else if (act === 'photos') editPhotos(id);
        else editHide(id);
      };
    });
  }

  function productChip(product) {
    var photo = mainPhoto(product);
    return '<div class="product-chip">'
      + (photo ? '<img src="' + esc(photo.url) + '" alt="">' : '<div class="ph"></div>')
      + '<strong>' + esc(product.name) + '</strong></div>';
  }

  function editPrice(id) {
    var product = products.find(function (p) { return p.id === id; });
    if (!product) return showMenu();
    setHeader('New price', true, function () { pickProduct('price'); });
    app.innerHTML = productChip(product)
      + '<div class="field-block"><label class="field" for="price">Price in TT dollars</label>'
      + '<input id="price" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(product.priceTtd) + '"></div>'
      + errBlock('err');
    setFooter('<button type="button" class="btn-primary" id="save-btn">Save price</button>');
    document.getElementById('save-btn').onclick = async function () {
      var err = document.getElementById('err');
      err.hidden = true;
      var btn = document.getElementById('save-btn');
      btn.disabled = true;
      try {
        await api('/api/admin/products', {
          method: 'PATCH',
          body: JSON.stringify({
            id: product.id,
            name: product.name,
            description: product.description,
            category: product.category,
            priceTtd: document.getElementById('price').value,
            hidden: product.hidden
          })
        });
        renderDone('/?product=' + encodeURIComponent(product.id), 'See this product');
      } catch (e) {
        err.hidden = false;
        err.textContent = friendlyError(e);
        btn.disabled = false;
      }
    };
  }

  function editPhotos(id) {
    var product = products.find(function (p) { return p.id === id; });
    if (!product) return showMenu();
    var photo = mainPhoto(product);
    setHeader('Product photo', true, function () { pickProduct('photos'); });
    app.innerHTML = productChip(product)
      + (photo ? '<img class="photo-preview" src="' + esc(photo.url) + '" alt="">' : '<div class="photo-empty">No photo yet</div>')
      + '<p class="muted">Use a clear photo in good light. We shrink it so it uploads faster on mobile data.</p>'
      + errBlock('err');
    setFooter('<label class="btn-primary file-btn">Take or choose photo<input type="file" accept="image/*" capture="environment" id="photo-in"></label>');
    document.getElementById('photo-in').onchange = async function (e) {
      var file = (e.target.files || [])[0];
      e.target.value = '';
      if (!file) return;
      var err = document.getElementById('err');
      err.hidden = true;
      setFooter('<button type="button" class="btn-primary" disabled>Uploading…</button>');
      try {
        var data = await blobToBase64(await compress(file));
        var main = mainPhoto(product);
        if (main && main.id) {
          await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ action: 'replace-photo', photoId: main.id, data: data }) });
        } else {
          await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ action: 'photo', productId: product.id, data: data, makeMain: true }) });
        }
        renderDone('/?product=' + encodeURIComponent(product.id), 'See this product');
      } catch (ex) {
        err.hidden = false;
        err.textContent = friendlyError(ex);
        setFooter('<label class="btn-primary file-btn">Try again<input type="file" accept="image/*" capture="environment" id="photo-in-retry"></label>');
        document.getElementById('photo-in-retry').onchange = function (ev) {
          document.getElementById('photo-in').onchange(ev);
        };
      }
    };
  }

  function editHide(id) {
    var product = products.find(function (p) { return p.id === id; });
    if (!product) return showMenu();
    var hidden = Boolean(product.hidden);
    setHeader('Hide or show', true, function () { pickProduct('hide'); });
    app.innerHTML = productChip(product)
      + '<p class="lead">' + (hidden ? 'This product is hidden from your website.' : 'This product is visible on your website.') + '</p>'
      + errBlock('err');
    var label = hidden ? 'Show on my website' : 'Hide from my website';
    setFooter('<button type="button" class="btn-primary" id="toggle-btn">' + label + '</button>');
    document.getElementById('toggle-btn').onclick = async function () {
      var err = document.getElementById('err');
      err.hidden = true;
      var btn = document.getElementById('toggle-btn');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ action: 'visibility', id: product.id, hidden: !hidden }) });
        renderDone('/products', 'See the shop');
      } catch (e) {
        err.hidden = false;
        err.textContent = friendlyError(e);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  }

  async function editWords() {
    setHeader('Homepage words', true, showMenu);
    showLoading('Loading your words…');
    try {
      await loadSettings();
    } catch (e) {
      app.innerHTML = '<p class="alert alert-error">' + esc(friendlyError(e)) + '</p>';
      return;
    }
    var hp = settingsCache.homepage || {};
    app.innerHTML = '<p class="lead">These appear on the first page visitors see.</p>'
      + '<div class="field-block"><label class="field" for="headline">Main headline</label>'
      + '<textarea id="headline" rows="3">' + esc(hp.heroHeadline || '') + '</textarea></div>'
      + '<div class="field-block"><label class="field" for="intro">Short intro line</label>'
      + '<textarea id="intro" rows="3">' + esc(hp.heroSubtext || '') + '</textarea></div>'
      + '<div class="field-block"><label class="field" for="about">About your shop</label>'
      + '<textarea id="about" rows="5">' + esc(hp.aboutText || '') + '</textarea></div>'
      + errBlock('err');
    setFooter('<button type="button" class="btn-primary" id="save-btn">Save words</button>');
    document.getElementById('save-btn').onclick = async function () {
      var err = document.getElementById('err');
      err.hidden = true;
      var btn = document.getElementById('save-btn');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await api('/api/admin/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            homepage: {
              heroHeadline: document.getElementById('headline').value,
              heroSubtext: document.getElementById('intro').value,
              aboutText: document.getElementById('about').value
            }
          })
        });
        await loadSettings();
        renderDone('/', 'See homepage');
      } catch (e) {
        err.hidden = false;
        err.textContent = friendlyError(e);
        btn.disabled = false;
        btn.textContent = 'Save words';
      }
    };
  }

  function themeGradient(colors) {
    return 'linear-gradient(135deg,' + colors[0] + ' 0%,' + colors[1] + ' 50%,' + colors[2] + ' 100%)';
  }

  async function editColours() {
    setHeader('Pick a look', true, showMenu);
    showLoading('Loading looks…');
    try {
      await loadSettings();
    } catch (e) {
      app.innerHTML = '<p class="alert alert-error">' + esc(friendlyError(e)) + '</p>';
      return;
    }
    var cards = THEME_CARDS.map(function (t) {
      return '<button type="button" class="theme-card" data-theme="' + esc(t.id) + '" style="background:' + themeGradient(t.colors) + '">'
        + esc(t.label) + '</button>';
    }).join('');
    var hasPrev = false;
    try { hasPrev = Boolean(localStorage.getItem(PREV_THEME_KEY)); } catch (e) { /* ignore */ }
    app.innerHTML = '<p class="lead">Tap a look. It goes live right away.</p>'
      + '<div class="theme-list">' + cards + '</div>'
      + (hasPrev ? '<button type="button" class="btn-secondary" style="margin-top:var(--space-4)" id="restore-btn">Go back to my old look</button>' : '')
      + errBlock('err');
    setFooter(null);
    app.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.onclick = function () { applyThemePreset(btn.getAttribute('data-theme')); };
    });
    if (hasPrev) document.getElementById('restore-btn').onclick = restorePreviousTheme;
  }

  async function applyThemePreset(presetId) {
    var err = document.getElementById('err');
    if (err) err.hidden = true;
    rememberThemeBeforeChange();
    showLoading('Applying look…');
    try {
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ theme: { preset: presetId } }) });
      await loadSettings();
      renderDone('/', 'See homepage');
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = friendlyError(e);
      }
      editColours();
    }
  }

  async function restorePreviousTheme() {
    var raw;
    try { raw = localStorage.getItem(PREV_THEME_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    rememberThemeBeforeChange();
    showLoading('Restoring…');
    try {
      var prev = JSON.parse(raw);
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ theme: prev }) });
      await loadSettings();
      renderDone('/', 'See homepage');
    } catch (e) {
      editColours();
      var err = document.getElementById('err');
      if (err) {
        err.hidden = false;
        err.textContent = friendlyError(e);
      }
    }
  }

  var wizard = { step: 0, photoBlob: null, photoUrl: '', name: '', price: '', category: '', description: '' };

  function startAddProduct() {
    wizard = { step: 0, photoBlob: null, photoUrl: '', name: '', price: '', category: '', description: '' };
    renderWizardStep();
  }

  function wizardStepsHtml() {
    return '<div class="steps" aria-hidden="true">' + [0, 1, 2, 3].map(function (i) {
      return '<span class="' + (i <= wizard.step ? 'on' : '') + '"></span>';
    }).join('') + '</div>';
  }

  function renderWizardStep() {
    setHeader('New product', true, wizard.step === 0 ? showMenu : function () {
      wizard.step -= 1;
      renderWizardStep();
    });
    if (wizard.step === 0) {
      app.innerHTML = wizardStepsHtml()
        + '<h2 class="page-title">Photo</h2>'
        + '<p class="lead">Take a picture or pick one from your gallery.</p>'
        + (wizard.photoUrl ? '<img class="photo-preview" src="' + esc(wizard.photoUrl) + '" alt="">' : '<div class="photo-empty"><i class="fas fa-camera" aria-hidden="true"></i></div>')
        + errBlock('err');
      setFooter('<div class="stack">'
        + '<label class="btn-secondary file-btn">' + (wizard.photoUrl ? 'Choose a different photo' : 'Add a photo')
        + '<input type="file" accept="image/*" capture="environment" id="wiz-photo"></label>'
        + '<button type="button" class="btn-primary" id="next-btn"' + (wizard.photoBlob ? '' : ' disabled') + '>Next</button></div>');
      document.getElementById('wiz-photo').onchange = function (e) {
        var file = (e.target.files || [])[0];
        e.target.value = '';
        if (!file) return;
        compress(file).then(function (blob) {
          if (wizard.photoUrl) URL.revokeObjectURL(wizard.photoUrl);
          wizard.photoBlob = blob;
          wizard.photoUrl = URL.createObjectURL(blob);
          renderWizardStep();
        });
      };
      document.getElementById('next-btn').onclick = function () { wizard.step = 1; renderWizardStep(); };
      return;
    }
    if (wizard.step === 1) {
      app.innerHTML = wizardStepsHtml()
        + '<h2 class="page-title">Name</h2>'
        + '<div class="field-block"><label class="field" for="wiz-name">What is it called?</label>'
        + '<input id="wiz-name" value="' + esc(wizard.name) + '" placeholder="e.g. Hex tile set" autocomplete="off"></div>'
        + errBlock('err');
      setFooter('<button type="button" class="btn-primary" id="next-btn">Next</button>');
      document.getElementById('next-btn').onclick = function () {
        wizard.name = document.getElementById('wiz-name').value.trim();
        if (!wizard.name) return;
        wizard.step = 2;
        renderWizardStep();
      };
      return;
    }
    if (wizard.step === 2) {
      app.innerHTML = wizardStepsHtml()
        + '<h2 class="page-title">Price</h2>'
        + '<div class="field-block"><label class="field" for="wiz-price">Price in TT dollars</label>'
        + '<input id="wiz-price" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(wizard.price) + '" placeholder="25"></div>'
        + errBlock('err');
      setFooter('<button type="button" class="btn-primary" id="next-btn">Next</button>');
      document.getElementById('next-btn').onclick = function () {
        wizard.price = document.getElementById('wiz-price').value;
        if (wizard.price === '' || Number(wizard.price) < 0) return;
        wizard.step = 3;
        renderWizardStep();
      };
      return;
    }
    var chips = CATEGORIES.map(function (c) {
      return '<button type="button" class="' + (wizard.category === c ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    app.innerHTML = wizardStepsHtml()
      + '<h2 class="page-title">Group</h2>'
      + '<p class="lead">Where should shoppers find it?</p>'
      + '<div class="chips">' + chips + '</div>'
      + '<div class="field-block"><label class="field" for="wiz-desc">Description (optional)</label>'
      + '<textarea id="wiz-desc" placeholder="Sizes, colours, or notes…">' + esc(wizard.description) + '</textarea></div>'
      + errBlock('err');
    setFooter('<button type="button" class="btn-primary" id="save-btn"' + (wizard.category ? '' : ' disabled') + '>Add to my website</button>');
    app.querySelectorAll('[data-cat]').forEach(function (btn) {
      btn.onclick = function () {
        wizard.category = btn.getAttribute('data-cat');
        document.getElementById('save-btn').disabled = false;
        app.querySelectorAll('[data-cat]').forEach(function (b) { b.classList.toggle('on', b === btn); });
      };
    });
    document.getElementById('save-btn').onclick = saveNewProduct;
  }

  async function saveNewProduct() {
    wizard.description = document.getElementById('wiz-desc').value.trim();
    var err = document.getElementById('err');
    err.hidden = true;
    var btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.textContent = 'Adding…';
    try {
      var created = await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          name: wizard.name,
          description: wizard.description || wizard.name,
          category: wizard.category,
          priceTtd: wizard.price
        })
      });
      var id = created.id;
      var list = created.products || [];
      var product = list.find(function (p) { return p.id === id; }) || list[list.length - 1];
      if (wizard.photoBlob && product) {
        var data = await blobToBase64(wizard.photoBlob);
        await api('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify({ action: 'photo', productId: product.id, data: data, makeMain: true })
        });
      }
      if (wizard.photoUrl) URL.revokeObjectURL(wizard.photoUrl);
      renderDone('/?product=' + encodeURIComponent(product ? product.id : id), 'See this product');
    } catch (e) {
      err.hidden = false;
      err.textContent = friendlyError(e);
      btn.disabled = false;
      btn.textContent = 'Add to my website';
    }
  }

  function databaseHelp() {
    setHeader('Setup needed', false, null);
    setFooter(null);
    app.innerHTML = '<div class="card"><p><strong>One step left before you can use this page.</strong></p>'
      + '<p class="muted">Ask your developer to connect the shop database in Vercel (Neon), then try again.</p></div>'
      + '<a class="btn-ghost-link" href="/admin/advanced.html">More settings</a>';
  }

  function authForm(mode) {
    var setup = mode === 'setup';
    setHeader(setup ? 'Welcome' : 'Sign in', false, null);
    setFooter(null);
    app.innerHTML = '<div class="auth-card"><form id="auth-form">'
      + (setup
        ? '<p>Choose a password only you will use on this phone.</p>'
        : '<p>Sign in to update your shop.</p>')
      + '<div class="field-block"><label class="field" for="password">' + (setup ? 'New password' : 'Password') + '</label>'
      + '<input id="password" type="password" autocomplete="' + (setup ? 'new-password' : 'current-password') + '" minlength="8" required></div>'
      + (setup ? '<div class="field-block"><label class="field" for="confirm">Type it again</label><input id="confirm" type="password" autocomplete="new-password" minlength="8" required></div>' : '')
      + errBlock('auth-status')
      + '<button class="btn-primary" type="submit" style="margin-top:var(--space-5)">' + (setup ? 'Continue' : 'Sign in') + '</button>'
      + '</form></div>';
    document.getElementById('auth-form').onsubmit = async function (event) {
      event.preventDefault();
      var password = document.getElementById('password').value;
      var status = document.getElementById('auth-status');
      if (setup && password !== document.getElementById('confirm').value) {
        status.hidden = false;
        status.textContent = 'Those passwords do not match.';
        return;
      }
      status.hidden = true;
      try {
        await api('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: setup ? 'setup' : 'login', password: password }) });
        if (returnAfterAuth()) return;
        showMenu();
      } catch (error) {
        status.hidden = false;
        status.textContent = friendlyError(error);
      }
    };
  }

  signOut.onclick = async function () {
    await api('/api/admin/auth', { method: 'DELETE' });
    signOut.hidden = true;
    location.reload();
  };

  function returnAfterAuth() {
    var params = new URLSearchParams(window.location.search);
    var dest = params.get('return') || params.get('next') || '';
    if (dest && dest.charAt(0) === '/' && dest.indexOf('/admin') === 0 && dest.indexOf('//') !== 0) {
      window.location.href = dest;
      return true;
    }
    return false;
  }

  api('/api/admin/auth').then(function (state) {
    if (state.needsDatabase) return databaseHelp();
    if (state.signedIn) {
      signOut.hidden = false;
      if (returnAfterAuth()) return;
      return showMenu();
    }
    authForm(state.needsSetup ? 'setup' : 'login');
  }).catch(function (error) {
    if (error.needsDatabase) databaseHelp();
    else {
      setHeader('Your shop', false, null);
      app.innerHTML = '<p class="alert alert-error">' + esc(friendlyError(error)) + '</p>';
    }
  });
})();
