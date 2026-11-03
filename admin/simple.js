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
  var signOut = document.getElementById('sign-out');
  var products = [];
  var settingsCache = null;

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

  function backQuiet(label) {
    return '<button type="button" class="quiet" id="back-btn">' + esc(label || '← Back') + '</button>';
  }

  function renderDone(seeUrl, seeLabel) {
    titleEl.textContent = 'All set';
    app.innerHTML = '<div class="done-box">'
      + '<i class="fas fa-circle-check" aria-hidden="true"></i>'
      + '<h2>Done – it\'s on your website</h2>'
      + '<p class="muted">Shoppers can see the change right away.</p>'
      + '<div class="split-actions">'
      + '<a class="btn primary" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="' + esc(seeUrl || '/') + '" target="_blank" rel="noopener">' + esc(seeLabel || 'See it') + '</a>'
      + '<button type="button" class="ghost" id="menu-btn">Back to menu</button>'
      + '</div></div>';
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
    titleEl.textContent = 'Your shop';
    signOut.hidden = false;
    app.innerHTML = '<p class="muted" style="margin:0.25rem 0 1rem">What would you like to do?</p>'
      + menuButton('add', 'fa-plus', 'Add a new product', 'Put something new in your shop')
      + menuButton('price', 'fa-tag', 'Change a price', 'Update what you charge')
      + menuButton('photos', 'fa-camera', 'Change or add photos', 'Swap or add product pictures')
      + menuButton('hide', 'fa-eye-slash', 'Sold out? Hide or show', 'Hide items you don\'t have right now')
      + menuButton('words', 'fa-pen', 'Change my homepage words', 'Headline and about text')
      + menuButton('colours', 'fa-palette', 'Change my colours', 'Pick a fresh look for your site')
      + '<p class="more-link"><a href="/admin/advanced.html">More settings (for your developer)</a></p>';
    bindMenu();
  }

  function menuButton(id, icon, label, sub) {
    return '<button type="button" class="menu-btn" data-go="' + esc(id) + '">'
      + '<i class="fas ' + icon + '" aria-hidden="true"></i>'
      + '<span><strong>' + esc(label) + '</strong><br><span class="muted" style="font-weight:400;font-size:0.88rem">' + esc(sub) + '</span></span>'
      + '</button>';
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
      return '<p class="banner bad">No products yet. Tap Add a new product first.</p>'
        + '<button type="button" class="ghost" id="menu-btn">Back to menu</button>';
    }
    return products.map(function (p) {
      var photo = mainPhoto(p);
      var img = photo
        ? '<img src="' + esc(photo.url) + '" alt="">'
        : '<div class="ph"></div>';
      var extra = p.hidden ? ' <span class="muted">(hidden)</span>' : '';
      return '<button type="button" class="pick" data-pick="' + esc(p.id) + '" data-action="' + esc(action) + '">'
        + img + '<span><strong>' + esc(p.name) + '</strong><span>' + money(p.priceTtd) + extra + '</span></span></button>';
    }).join('');
  }

  async function pickProduct(action) {
    titleEl.textContent = action === 'price' ? 'Change a price'
      : action === 'photos' ? 'Change photos' : 'Hide or show';
    await loadProducts();
    app.innerHTML = backQuiet('← Back to menu')
      + '<p class="muted">Tap the product you mean.</p>'
      + productPickList(action);
    document.getElementById('back-btn').onclick = showMenu;
    if (!products.length) {
      document.getElementById('menu-btn').onclick = showMenu;
      return;
    }
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

  function editPrice(id) {
    var product = products.find(function (p) { return p.id === id; });
    if (!product) return showMenu();
    titleEl.textContent = 'New price';
    app.innerHTML = backQuiet('← Choose another product')
      + '<p class="card"><strong>' + esc(product.name) + '</strong></p>'
      + '<label class="field" for="price">Price in TT dollars</label>'
      + '<input id="price" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(product.priceTtd) + '">'
      + '<p id="err" class="banner bad" hidden></p>'
      + '<button type="button" class="primary" style="margin-top:1.25rem" id="save-btn">Save price</button>';
    document.getElementById('back-btn').onclick = function () { pickProduct('price'); };
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
    titleEl.textContent = 'Product photos';
    app.innerHTML = backQuiet('← Choose another product')
      + '<p class="card"><strong>' + esc(product.name) + '</strong></p>'
      + (photo ? '<img class="photo-preview" src="' + esc(photo.url) + '" alt="">' : '')
      + '<label class="primary file-btn" style="display:flex;margin-top:0.5rem">Take or choose a photo<input type="file" accept="image/*" capture="environment" hidden id="photo-in"></label>'
      + '<p class="muted">Tip: use a clear photo in good light. We shrink it so it uploads faster.</p>'
      + '<p id="err" class="banner bad" hidden></p>';
    document.getElementById('back-btn').onclick = function () { pickProduct('photos'); };
    document.getElementById('photo-in').onchange = async function (e) {
      var file = (e.target.files || [])[0];
      e.target.value = '';
      if (!file) return;
      var err = document.getElementById('err');
      err.hidden = true;
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
      }
    };
  }

  function editHide(id) {
    var product = products.find(function (p) { return p.id === id; });
    if (!product) return showMenu();
    titleEl.textContent = 'Hide or show';
    var hidden = Boolean(product.hidden);
    app.innerHTML = backQuiet('← Choose another product')
      + '<p class="card"><strong>' + esc(product.name) + '</strong></p>'
      + '<p class="muted">' + (hidden ? 'This is hidden from your website right now.' : 'This is visible on your website now.') + '</p>'
      + '<p id="err" class="banner bad" hidden></p>'
      + '<button type="button" class="big-toggle ' + (hidden ? 'show' : 'hide') + '" id="toggle-btn">'
      + (hidden ? 'Show on my website' : 'Hide from my website') + '</button>';
    document.getElementById('back-btn').onclick = function () { pickProduct('hide'); };
    document.getElementById('toggle-btn').onclick = async function () {
      var err = document.getElementById('err');
      err.hidden = true;
      var btn = document.getElementById('toggle-btn');
      btn.disabled = true;
      try {
        await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ action: 'visibility', id: product.id, hidden: !hidden }) });
        renderDone('/products', 'See the shop');
      } catch (e) {
        err.hidden = false;
        err.textContent = friendlyError(e);
        btn.disabled = false;
      }
    };
  }

  async function editWords() {
    titleEl.textContent = 'Homepage words';
    await loadSettings();
    var hp = settingsCache.homepage || {};
    app.innerHTML = backQuiet('← Back to menu')
      + '<p class="muted">These show on the main page visitors see first.</p>'
      + '<label class="field" for="headline">Main headline</label>'
      + '<textarea id="headline" rows="3">' + esc(hp.heroHeadline || '') + '</textarea>'
      + '<label class="field" for="intro">Short intro line</label>'
      + '<textarea id="intro" rows="3">' + esc(hp.heroSubtext || '') + '</textarea>'
      + '<label class="field" for="about">About your shop</label>'
      + '<textarea id="about" rows="5">' + esc(hp.aboutText || '') + '</textarea>'
      + '<p id="err" class="banner bad" hidden></p>'
      + '<button type="button" class="primary" style="margin-top:1.25rem" id="save-btn">Save words</button>';
    document.getElementById('back-btn').onclick = showMenu;
    document.getElementById('save-btn').onclick = async function () {
      var err = document.getElementById('err');
      err.hidden = true;
      var btn = document.getElementById('save-btn');
      btn.disabled = true;
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
      }
    };
  }

  function themeGradient(colors) {
    return 'linear-gradient(135deg,' + colors[0] + ' 0%,' + colors[1] + ' 50%,' + colors[2] + ' 100%)';
  }

  async function editColours() {
    titleEl.textContent = 'Pick a look';
    await loadSettings();
    var cards = THEME_CARDS.map(function (t) {
      return '<button type="button" class="theme-card" data-theme="' + esc(t.id) + '" style="background:' + themeGradient(t.colors) + '">'
        + esc(t.label) + '</button>';
    }).join('');
    var hasPrev = false;
    try { hasPrev = Boolean(localStorage.getItem(PREV_THEME_KEY)); } catch (e) { /* ignore */ }
    app.innerHTML = backQuiet('← Back to menu')
      + '<p class="muted">Tap a look. It goes live right away.</p>'
      + cards
      + (hasPrev ? '<button type="button" class="ghost" id="restore-btn">Go back to my old look</button>' : '')
      + '<p id="err" class="banner bad" hidden></p>';
    document.getElementById('back-btn').onclick = showMenu;
    app.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.onclick = function () { applyThemePreset(btn.getAttribute('data-theme')); };
    });
    if (hasPrev) {
      document.getElementById('restore-btn').onclick = restorePreviousTheme;
    }
  }

  async function applyThemePreset(presetId) {
    var err = document.getElementById('err');
    if (err) err.hidden = true;
    rememberThemeBeforeChange();
    try {
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ theme: { preset: presetId } }) });
      await loadSettings();
      renderDone('/', 'See homepage');
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = friendlyError(e);
      }
    }
  }

  async function restorePreviousTheme() {
    var err = document.getElementById('err');
    var raw;
    try { raw = localStorage.getItem(PREV_THEME_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    if (err) err.hidden = true;
    try {
      var prev = JSON.parse(raw);
      rememberThemeBeforeChange();
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ theme: prev }) });
      await loadSettings();
      renderDone('/', 'See homepage');
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = friendlyError(e);
      }
    }
  }

  /* Add product wizard */
  var wizard = { step: 0, photoBlob: null, photoUrl: '', name: '', price: '', category: '', description: '' };

  function startAddProduct() {
    wizard = { step: 0, photoBlob: null, photoUrl: '', name: '', price: '', category: '', description: '' };
    renderWizardStep();
  }

  function renderWizardStep() {
    var steps = [0, 1, 2, 3].map(function (i) {
      return '<span class="' + (i <= wizard.step ? 'on' : '') + '"></span>';
    }).join('');
    titleEl.textContent = 'New product';
    if (wizard.step === 0) {
      app.innerHTML = backQuiet('← Back to menu')
        + '<div class="steps">' + steps + '</div>'
        + '<h2>Step 1 — Photo</h2>'
        + '<p class="muted">Take a picture or pick one from your gallery.</p>'
        + (wizard.photoUrl ? '<img class="photo-preview" src="' + esc(wizard.photoUrl) + '" alt="">' : '')
        + '<label class="primary file-btn" style="display:flex">' + (wizard.photoUrl ? 'Choose a different photo' : 'Add a photo')
        + '<input type="file" accept="image/*" capture="environment" hidden id="wiz-photo"></label>'
        + '<button type="button" class="ghost" style="margin-top:0.5rem" id="next-btn"' + (wizard.photoBlob ? '' : ' disabled') + '>Next</button>';
      document.getElementById('back-btn').onclick = showMenu;
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
      app.innerHTML = backQuiet('← Back')
        + '<div class="steps">' + steps + '</div>'
        + '<h2>Step 2 — Name</h2>'
        + '<label class="field" for="wiz-name">What is it called?</label>'
        + '<input id="wiz-name" value="' + esc(wizard.name) + '" placeholder="e.g. Hex tile set">'
        + '<button type="button" class="primary" style="margin-top:1.25rem" id="next-btn">Next</button>';
      document.getElementById('back-btn').onclick = function () { wizard.step = 0; renderWizardStep(); };
      document.getElementById('next-btn').onclick = function () {
        wizard.name = document.getElementById('wiz-name').value.trim();
        if (!wizard.name) return;
        wizard.step = 2;
        renderWizardStep();
      };
      return;
    }
    if (wizard.step === 2) {
      app.innerHTML = backQuiet('← Back')
        + '<div class="steps">' + steps + '</div>'
        + '<h2>Step 3 — Price</h2>'
        + '<label class="field" for="wiz-price">Price in TT dollars</label>'
        + '<input id="wiz-price" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(wizard.price) + '" placeholder="25">'
        + '<button type="button" class="primary" style="margin-top:1.25rem" id="next-btn">Next</button>';
      document.getElementById('back-btn').onclick = function () { wizard.step = 1; renderWizardStep(); };
      document.getElementById('next-btn').onclick = function () {
        wizard.price = document.getElementById('wiz-price').value;
        if (wizard.price === '' || Number(wizard.price) < 0) return;
        wizard.step = 3;
        renderWizardStep();
      };
      return;
    }
    var chips = CATEGORIES.map(function (c) {
      var on = wizard.category === c ? ' on' : '';
      return '<button type="button" class="' + on + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    app.innerHTML = backQuiet('← Back')
      + '<div class="steps">' + steps + '</div>'
      + '<h2>Step 4 — Group</h2>'
      + '<p class="muted">Where should shoppers find it?</p>'
      + '<div class="chips">' + chips + '</div>'
      + '<label class="field" for="wiz-desc">Description (optional)</label>'
      + '<textarea id="wiz-desc" placeholder="A short note about sizes or colours…">' + esc(wizard.description) + '</textarea>'
      + '<p id="err" class="banner bad" hidden></p>'
      + '<button type="button" class="primary" style="margin-top:1.25rem" id="save-btn"' + (wizard.category ? '' : ' disabled') + '>Add to my website</button>';
    document.getElementById('back-btn').onclick = function () { wizard.step = 2; renderWizardStep(); };
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
    }
  }

  function databaseHelp() {
    app.innerHTML = '<div class="card"><p><strong>One step left before you can use this page.</strong></p>'
      + '<p class="muted">Ask your developer to connect the shop database in Vercel (Neon), then try again.</p>'
      + '<p class="more-link"><a href="/admin/advanced.html">More settings</a></p></div>';
  }

  function authForm(mode) {
    var setup = mode === 'setup';
    titleEl.textContent = setup ? 'Welcome' : 'Sign in';
    app.innerHTML = '<form id="auth-form" class="card">'
      + (setup
        ? '<p>Choose a password only you will use on this phone.</p>'
        : '<p>Sign in to update your shop.</p>')
      + '<label class="field" for="password">' + (setup ? 'New password' : 'Password') + '</label>'
      + '<input id="password" type="password" autocomplete="' + (setup ? 'new-password' : 'current-password') + '" minlength="8" required>'
      + (setup ? '<label class="field" for="confirm">Type it again</label><input id="confirm" type="password" autocomplete="new-password" minlength="8" required>' : '')
      + '<p id="auth-status" class="banner bad" hidden></p>'
      + '<button class="primary" type="submit" style="margin-top:1rem">' + (setup ? 'Continue' : 'Sign in') + '</button>'
      + '</form>';
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

  api('/api/admin/auth').then(function (state) {
    if (state.needsDatabase) return databaseHelp();
    if (state.signedIn) {
      signOut.hidden = false;
      return showMenu();
    }
    authForm(state.needsSetup ? 'setup' : 'login');
  }).catch(function (error) {
    if (error.needsDatabase) databaseHelp();
    else app.innerHTML = '<p class="banner bad">' + esc(friendlyError(error)) + '</p>';
  });
})();
