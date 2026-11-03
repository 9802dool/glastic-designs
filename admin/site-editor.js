(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('adminEdit') !== '1' || params.get('visualEdit') !== '1') return;

  var PAGES = [
    { path: '/', label: 'Home' },
    { path: '/products', label: 'Shop' },
    { path: '/about', label: 'About' },
    { path: '/gallery', label: 'Gallery' },
    { path: '/process', label: 'How we make it' },
    { path: '/impact', label: 'Impact' },
    { path: '/contact', label: 'Contact' }
  ];

  var published = { settings: null, gallery: [], products: [] };
  var draft = { settings: null, gallery: [], products: [] };
  var meta = { presets: [] };
  var undoStack = [];
  var dirty = false;
  var saving = false;
  var currentPath = window.location.pathname || '/';

  var gate = null;
  var pageSelect = null;
  var dirtyDot = null;
  var btnSave = null;
  var btnUndo = null;
  var toast = null;
  var lookList = null;
  var colourSheet = null;
  var sheetBackdrop = null;

  var AUTH_TIMEOUT_MS = 20000;
  var DATA_TIMEOUT_MS = 25000;
  var BOOT_TIMEOUT_MS = 45000;
  var DRAFT_NAV_KEY = 'glastic-admin-edit-draft-v1';

  window.__GLASTIC_EDIT_SESSION_OK = false;

  function logEdit(stage, detail) {
    try {
      console.info('[glastic-edit]', stage, detail !== undefined ? detail : '');
    } catch (e) { /* ignore */ }
  }

  function editNavUrl(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'adminEdit=1&visualEdit=1';
  }

  function api(url, options) {
    var opts = Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    }, options || {});
    var timeoutMs = opts.timeoutMs || 0;
    delete opts.timeoutMs;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller && timeoutMs > 0) {
      opts.signal = controller.signal;
      setTimeout(function () { controller.abort(); }, timeoutMs);
    }
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try { data = JSON.parse(text); } catch (e) {
            if (!res.ok) {
              throw new Error(res.status === 401 || res.status === 403
                ? 'Please sign in again.'
                : 'The server returned an unexpected response (status ' + res.status + ').');
            }
            throw new Error('The server returned an unexpected response.');
          }
        }
        if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), data);
        return data;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('This is taking too long — check your internet and try again.');
      }
      throw err;
    });
  }

  function cloneData(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function previewPayload() {
    return { settings: draft.settings, gallery: draft.gallery };
  }

  function postPreview() {
    if (window.GLASTIC_APPLY_SETTINGS) {
      window.GLASTIC_APPLY_SETTINGS(previewPayload());
    }
    if (window.GLASTIC_RENDER_CATALOG) {
      window.GLASTIC_RENDER_CATALOG(draft.products.slice());
    }
    if (window.__glasticVisualEditRefresh) window.__glasticVisualEditRefresh();
  }

  function updateStatusPill(text, tone) {
    var pill = document.getElementById('glastic-edit-status');
    if (!pill) return;
    pill.textContent = text;
    pill.className = 'status-pill' + (tone ? ' ' + tone : '');
  }

  function enableInlineEdit() {
    logEdit('enable-inline', 'start');
    postPreview();
    var enabled = false;
    if (window.__GLASTIC_REQUEST_VISUAL_EDIT_ENABLE) {
      enabled = window.__GLASTIC_REQUEST_VISUAL_EDIT_ENABLE('site-editor');
    } else if (window.__glasticEnableVisualEdit) {
      window.__glasticEnableVisualEdit();
      enabled = true;
    } else {
      window.__GLASTIC_PENDING_VISUAL_ENABLE = true;
    }
    var markCount = document.querySelectorAll('[data-editable]').length;
    logEdit('enable-inline', enabled ? markCount + ' marks' : 'pending visual script');
    if (markCount > 0) {
      updateStatusPill('Editing on: tap any outlined item', 'ok');
    } else {
      updateStatusPill('Loading editable areas…', 'warn');
    }
  }

  function enableInlineEditWithRetries() {
    enableInlineEdit();
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      var count = document.querySelectorAll('[data-editable]').length;
      if (count > 0 && window.GLASTIC_VISUAL_EDIT_ACTIVE) {
        updateStatusPill('Editing on: tap any outlined item', 'ok');
        clearInterval(timer);
        logEdit('enable-inline', 'stable after ' + attempts + ' retries');
        return;
      }
      if (window.__GLASTIC_EDIT_SESSION_OK) enableInlineEdit();
      if (attempts >= 12) {
        clearInterval(timer);
        if (count === 0) {
          updateStatusPill('Edit mode failed to start — Try again', 'err');
          logEdit('enable-inline-failed', 'no data-editable nodes');
        }
      }
    }, 250);
  }

  function persistDraftForNavigation() {
    try {
      sessionStorage.setItem(DRAFT_NAV_KEY, JSON.stringify({
        settings: draft.settings,
        gallery: draft.gallery,
        products: draft.products,
        pending: window.__vePendingUploads || [],
        dirty: dirty
      }));
      logEdit('draft-persist', 'sessionStorage');
    } catch (e) {
      logEdit('draft-persist-failed', String(e && e.message));
    }
  }

  function restoreDraftFromNavigation() {
    try {
      var raw = sessionStorage.getItem(DRAFT_NAV_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DRAFT_NAV_KEY);
      var snap = JSON.parse(raw);
      if (snap.settings) draft.settings = snap.settings;
      if (snap.gallery) draft.gallery = snap.gallery;
      if (snap.products) draft.products = snap.products;
      window.__vePendingUploads = snap.pending || [];
      setDirty(Boolean(snap.dirty));
      postPreview();
      logEdit('draft-restore', 'from sessionStorage');
    } catch (e) {
      logEdit('draft-restore-failed', String(e && e.message));
    }
  }

  function navigateTo(path) {
    if (path === currentPath) return;
    if (dirty && !confirm('You have unsaved changes. Switch pages anyway?')) {
      if (pageSelect) pageSelect.value = currentPath;
      return;
    }
    persistDraftForNavigation();
    window.location.href = editNavUrl(path);
  }

  function pushUndo() {
    undoStack.push({
      settings: cloneData(draft.settings),
      gallery: cloneData(draft.gallery),
      products: cloneData(draft.products),
      pending: cloneData(window.__vePendingUploads || [])
    });
    if (undoStack.length > 40) undoStack.shift();
    btnUndo.disabled = undoStack.length === 0;
  }

  function applyDraftSnapshot(snap) {
    draft.settings = cloneData(snap.settings);
    draft.gallery = cloneData(snap.gallery);
    draft.products = cloneData(snap.products);
    window.__vePendingUploads = cloneData(snap.pending || []);
    postPreview();
  }

  function setNested(obj, pathParts, value) {
    var cur = obj;
    for (var i = 0; i < pathParts.length - 1; i++) {
      var key = pathParts[i];
      if (cur[key] == null) cur[key] = /^\d+$/.test(pathParts[i + 1]) ? [] : {};
      cur = cur[key];
    }
    cur[pathParts[pathParts.length - 1]] = value;
  }

  function parseKey(key) {
    return key.split('.');
  }

  function applyChange(key, value, skipUndo) {
    if (!skipUndo) pushUndo();
    var s = draft.settings;
    if (key === 'banner.enabled') {
      s.banner.enabled = Boolean(value);
    } else if (key === 'banner.text') s.banner.text = value;
    else if (key === 'banner.link') s.banner.link = value;
    else if (key === 'theme.logoUrl') s.theme.logoUrl = value;
    else if (key.indexOf('homepage.') === 0) {
      var hpKey = key.slice('homepage.'.length);
      if (hpKey.indexOf('processSteps.') === 0) {
        var bits = hpKey.split('.');
        var idx = Number(bits[1]);
        var field = bits[2];
        if (!s.homepage.processSteps[idx]) s.homepage.processSteps[idx] = { title: '', text: '' };
        s.homepage.processSteps[idx][field] = value;
      } else if (hpKey === 'heroFacebook') {
        s.contact.facebook = value;
      } else {
        s.homepage[hpKey] = value;
      }
    } else if (key === 'gallery.title' || key === 'gallery.subtitle') {
      s.gallery[key.split('.')[1]] = value;
    } else if (key.indexOf('gallery.item.') === 0 && key.indexOf('.caption') > 0) {
      var gid = key.slice('gallery.item.'.length).replace('.caption', '');
      var item = draft.gallery.find(function (g) { return g.id === gid; });
      if (item) item.caption = value;
    } else if (key.indexOf('gallery.item.') === 0) {
      var gidUrl = key.slice('gallery.item.'.length);
      var gitem = draft.gallery.find(function (g) { return g.id === gidUrl; });
      if (gitem) gitem.url = value;
    } else if (key === 'impact.title') s.impact.title = value;
    else if (key.indexOf('impact.bullets.') === 0) {
      s.impact.bullets[Number(key.split('.')[2])] = value;
    } else if (key.indexOf('impact.stats.') === 0) {
      var sb = key.split('.');
      var si = Number(sb[2]);
      var sf = sb[3];
      if (!s.impact.stats[si]) s.impact.stats[si] = { value: '', label: '' };
      s.impact.stats[si][sf] = value;
    } else if (key.indexOf('contact.') === 0) {
      s.contact[key.slice('contact.'.length)] = value;
    } else if (key.indexOf('product.') === 0) {
      var rest = key.slice('product.'.length);
      var dot = rest.indexOf('.');
      var pid = dot >= 0 ? rest.slice(0, dot) : rest;
      var prod = draft.products.find(function (p) { return p.id === pid; });
      if (!prod) return;
      if (dot < 0) return;
      var pf = rest.slice(dot + 1);
      if (pf === 'hidden') prod.hidden = Boolean(value);
      else if (pf === 'name') prod.name = value;
      else if (pf === 'description') prod.description = value;
      else if (pf === 'priceTtd') prod.priceTtd = value;
      else if (pf === 'photoUrl') {
        var main = (prod.photos || []).find(function (p) { return p.isMain; }) || (prod.photos || [])[0];
        if (main) main.url = value;
      }
    }
    setDirty(true);
    postPreview();
  }

  function applyThemePreset(presetId) {
    var preset = meta.presets.find(function (p) { return p.id === presetId; });
    if (!preset) return;
    pushUndo();
    Object.assign(draft.settings.theme, {
      preset: preset.id,
      primary: preset.primary,
      primaryDark: preset.primaryDark,
      accent: preset.accent,
      background: preset.background,
      text: preset.text
    });
    setDirty(true);
    postPreview();
    renderLookButtons();
    closeSheet();
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove('show'); }, 3200);
  }

  function renderLookButtons() {
    if (!lookList) return;
    var theme = draft.settings.theme;
    lookList.innerHTML = meta.presets.map(function (p) {
      var on = theme.preset === p.id ? ' style="outline:3px solid #0f766e"' : '';
      return '<button type="button" class="look-btn" data-preset="' + p.id + '"' + on
        + ' style="background:linear-gradient(135deg,' + p.primaryDark + ',' + p.accent + ')">'
        + p.label + '</button>';
    }).join('');
    lookList.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.onclick = function () {
        applyThemePreset(btn.getAttribute('data-preset'));
      };
    });
  }

  function openSheet() {
    renderLookButtons();
    colourSheet.hidden = false;
    sheetBackdrop.hidden = false;
  }

  function closeSheet() {
    colourSheet.hidden = true;
    sheetBackdrop.hidden = true;
  }

  async function flushPendingUploads() {
    var queue = window.__vePendingUploads || [];
    if (!queue.length) return;
    window.__vePendingUploads = [];
    for (var i = 0; i < queue.length; i++) {
      var job = queue[i];
      if (job.action === 'logo') {
        var r = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'logo', data: job.data }) });
        if (r.settings && r.settings.theme) draft.settings.theme.logoUrl = r.settings.theme.logoUrl;
      } else if (job.action === 'hero-image') {
        var r2 = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'hero-image', data: job.data }) });
        if (r2.settings && r2.settings.homepage) draft.settings.homepage.heroImage = r2.settings.homepage.heroImage;
      } else if (job.action === 'about-image') {
        var r3 = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'about-image', data: job.data }) });
        if (r3.settings && r3.settings.homepage) draft.settings.homepage.aboutImage = r3.settings.homepage.aboutImage;
      } else if (job.action === 'gallery-replace') {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-delete', id: job.id }) });
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-photo', data: job.data, caption: job.caption || '' }) });
      } else if (job.action === 'product-photo') {
        if (job.photoId) {
          await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ action: 'replace-photo', photoId: job.photoId, data: job.data }) });
        } else {
          await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ action: 'photo', productId: job.productId, data: job.data, makeMain: true }) });
        }
      }
    }
    var needsGallery = queue.some(function (j) { return j.action === 'gallery-replace'; });
    var needsProducts = queue.some(function (j) { return j.action === 'product-photo'; });
    if (needsGallery) {
      var data = await api('/api/admin/settings');
      draft.gallery = data.gallery || draft.gallery;
    }
    if (needsProducts) {
      var pdata = await api('/api/admin/products');
      draft.products = pdata.products || draft.products;
    }
  }

  async function saveAll() {
    if (saving) return;
    saving = true;
    btnSave.disabled = true;
    btnSave.textContent = 'Saving…';
    try {
      await flushPendingUploads();
      var s = draft.settings;
      var hp = s.homepage;
      var payload = {
        theme: Object.assign({}, s.theme),
        homepage: {
          heroBadge: hp.heroBadge,
          heroHeadline: hp.heroHeadline,
          heroSubtext: hp.heroSubtext,
          heroBadgeNote: hp.heroBadgeNote,
          heroBadgeCaption: hp.heroBadgeCaption,
          aboutEyebrow: hp.aboutEyebrow,
          aboutTitle: hp.aboutTitle,
          aboutText: hp.aboutText,
          processSteps: hp.processSteps
        },
        gallery: s.gallery,
        impact: s.impact,
        contact: s.contact,
        banner: s.banner,
        visibility: s.visibility
      };
      for (var i = 0; i < draft.gallery.length; i++) {
        var item = draft.gallery[i];
        var pub = published.gallery.find(function (g) { return g.id === item.id; });
        if (pub && pub.caption !== item.caption) {
          await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-caption', id: item.id, caption: item.caption }) });
        }
      }
      var res = await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      draft.settings = res.settings;
      draft.gallery = res.gallery || draft.gallery;

      for (var j = 0; j < draft.products.length; j++) {
        var p = draft.products[j];
        var was = published.products.find(function (x) { return x.id === p.id; });
        if (!was) continue;
        if (was.name !== p.name || was.description !== p.description || String(was.priceTtd) !== String(p.priceTtd)
          || was.category !== p.category || Boolean(was.hidden) !== Boolean(p.hidden)) {
          await api('/api/admin/products', {
            method: 'PATCH',
            body: JSON.stringify({
              id: p.id,
              name: p.name,
              description: p.description,
              priceTtd: p.priceTtd,
              category: p.category,
              hidden: p.hidden
            })
          });
        }
      }
      var pdata = await api('/api/admin/products');
      draft.products = pdata.products;
      published = {
        settings: cloneData(draft.settings),
        gallery: cloneData(draft.gallery),
        products: cloneData(draft.products)
      };
      undoStack = [];
      btnUndo.disabled = true;
      setDirty(false);
      showToast('Saved – it\'s on your website');
      postPreview();
    } catch (err) {
      showToast((err && err.message) || 'Could not save');
    } finally {
      saving = false;
      btnSave.textContent = 'Save';
      btnSave.disabled = false;
    }
  }

  function onEditBusMessage(data) {
    if (!data || data.source !== 'glastic-visual-edit') return;
    if (data.type === 'change') applyChange(data.key, data.value);
    if (data.type === 'pending-upload') {
      pushUndo();
      window.__vePendingUploads = window.__vePendingUploads || [];
      window.__vePendingUploads.push(data.job);
      if (data.previewUrl && data.key) applyChange(data.key, data.previewUrl, true);
      setDirty(true);
      postPreview();
    }
  }

  async function loadData() {
    logEdit('loadData:start');
    var sdata = await api('/api/admin/settings', { timeoutMs: DATA_TIMEOUT_MS });
    logEdit('loadData:settings-ok');
    var pdata = await api('/api/admin/products', { timeoutMs: DATA_TIMEOUT_MS });
    logEdit('loadData:products-ok');
    meta.presets = (sdata.meta && sdata.meta.presets) || sdata.presets || [];
    draft.settings = sdata.settings;
    draft.gallery = sdata.gallery || [];
    draft.products = pdata.products || [];
    published = {
      settings: cloneData(draft.settings),
      gallery: cloneData(draft.gallery),
      products: cloneData(draft.products)
    };
    window.__vePendingUploads = [];
    undoStack = [];
    setDirty(false);
    restoreDraftFromNavigation();
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function showLoading(message) {
    if (!gate) return;
    gate.hidden = false;
    gate.innerHTML = '<div style="text-align:center"><div class="spinner" aria-hidden="true"></div><p>'
      + esc(message || 'Loading editor…') + '</p></div>';
  }

  function showErrorPanel(title, message) {
    logEdit('error', title + ': ' + message);
    if (!gate) return;
    gate.hidden = false;
    gate.innerHTML = '<div class="panel"><h1 style="margin:0 0 0.5rem;font-size:1.25rem">' + esc(title)
      + '</h1><p style="margin:0;color:#57534e">' + esc(message)
      + '</p><p style="margin-top:1rem"><a href="/admin/" style="color:#0f766e">Back to menu</a> · '
      + '<button type="button" id="gate-retry" style="border:0;background:none;color:#0f766e;font:inherit;cursor:pointer">Try again</button></p></div>';
    var retry = document.getElementById('gate-retry');
    if (retry) retry.onclick = function () { location.reload(); };
  }

  function showSignInForm(needsSetup) {
    window.__GLASTIC_EDIT_SESSION_OK = false;
    if (window.__glasticDisableVisualEdit) window.__glasticDisableVisualEdit();
    showSignInBanner();
    gate.hidden = false;
    gate.innerHTML = '<div class="panel"><h1 style="margin:0 0 0.5rem;font-size:1.25rem">' + (needsSetup ? 'Welcome' : 'Sign in') + '</h1><p style="color:#57534e">'
      + (needsSetup ? 'Choose a password for your shop admin, then open the editor.'
        : 'Sign in with your shop password to edit your website here.')
      + '</p><form id="gate-auth"><label for="gate-password">'
      + (needsSetup ? 'New password' : 'Password') + '</label>'
      + '<input id="gate-password" type="password" autocomplete="' + (needsSetup ? 'new-password' : 'current-password') + '" minlength="8" required>'
      + (needsSetup ? '<label for="gate-confirm">Type it again</label><input id="gate-confirm" type="password" autocomplete="new-password" minlength="8" required>' : '')
      + '<p id="gate-auth-error" class="alert" hidden role="alert"></p>'
      + '<div class="btn-row"><button type="submit" class="btn-primary">'
      + (needsSetup ? 'Continue' : 'Sign in') + '</button>'
      + '<a class="btn btn-secondary" href="/admin/?return=' + encodeURIComponent('/?adminEdit=1&visualEdit=1') + '">Use full sign-in page</a>'
      + '<a class="btn btn-secondary" href="/admin/">Back to menu</a></div></form></div>';
    var bannerBtn = document.getElementById('glastic-signin-banner-btn');
    if (bannerBtn) {
      bannerBtn.onclick = function () {
        var pw = document.getElementById('gate-password');
        if (pw) pw.focus();
        gate.hidden = false;
      };
    }
    document.getElementById('gate-auth').onsubmit = function (event) {
      event.preventDefault();
      var password = document.getElementById('gate-password').value;
      var errEl = document.getElementById('gate-auth-error');
      if (needsSetup && password !== document.getElementById('gate-confirm').value) {
        errEl.hidden = false;
        errEl.textContent = 'Those passwords do not match.';
        return;
      }
      errEl.hidden = true;
      showLoading('Signing in…');
      api('/api/admin/auth', {
        method: 'POST',
        body: JSON.stringify({ action: needsSetup ? 'setup' : 'login', password: password }),
        timeoutMs: AUTH_TIMEOUT_MS
      }).then(function () {
        window.__GLASTIC_EDIT_SESSION_OK = true;
        hideSignInBanner();
        return startEditor();
      }).catch(function (err) {
        showSignInForm(needsSetup);
        errEl = document.getElementById('gate-auth-error');
        if (errEl) {
          errEl.hidden = false;
          errEl.textContent = (err && err.message) || 'Sign-in failed.';
        }
      });
    };
  }

  function injectChrome() {
    document.documentElement.classList.add('glastic-admin-edit');
    gate = document.createElement('div');
    gate.id = 'glastic-edit-gate';
    gate.setAttribute('role', 'status');
    document.body.appendChild(gate);

    var bar = document.createElement('header');
    bar.id = 'glastic-edit-toolbar';
    bar.innerHTML = '<div class="toolbar-inner">'
      + '<button type="button" class="ghost" id="glastic-btn-exit" aria-label="Exit editor"><i class="fas fa-times"></i></button>'
      + '<select id="glastic-page-select" aria-label="Page"></select>'
      + '<span id="glastic-dirty-dot" title="Unsaved changes" style="width:0.5rem;height:0.5rem;border-radius:999px;background:#ea580c;display:none"></span>'
      + '<span id="glastic-edit-status" class="status-pill warn">Starting editor…</span>'
      + '<span style="flex:1"></span>'
      + '<button type="button" class="icon-only" id="glastic-btn-undo" disabled aria-label="Undo"><i class="fas fa-rotate-left"></i><span class="btn-text">Undo</span></button>'
      + '<button type="button" class="icon-only" id="glastic-btn-colours" aria-label="Colours"><i class="fas fa-palette"></i><span class="btn-text">Colours</span></button>'
      + '<button type="button" class="primary" id="glastic-btn-save"><span class="btn-text">Save</span></button>'
      + '</div>';
    document.body.appendChild(bar);

    sheetBackdrop = document.createElement('button');
    sheetBackdrop.type = 'button';
    sheetBackdrop.id = 'glastic-edit-sheet-backdrop';
    sheetBackdrop.hidden = true;
    sheetBackdrop.setAttribute('aria-label', 'Close');
    document.body.appendChild(sheetBackdrop);

    colourSheet = document.createElement('div');
    colourSheet.id = 'glastic-edit-sheet';
    colourSheet.hidden = true;
    colourSheet.innerHTML = '<h2 style="margin:0 0 0.75rem">Pick a look</h2><div id="glastic-look-list"></div>';
    document.body.appendChild(colourSheet);

    toast = document.createElement('div');
    toast.id = 'glastic-edit-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);

    var signBanner = document.createElement('div');
    signBanner.id = 'glastic-edit-signin-banner';
    signBanner.hidden = true;
    signBanner.innerHTML = '<p><strong>Sign in to edit</strong> — your shop password is required to change the live site.</p>'
      + '<button type="button" class="primary" id="glastic-signin-banner-btn">Sign in</button>';
    document.body.appendChild(signBanner);

    pageSelect = document.getElementById('glastic-page-select');
    dirtyDot = document.getElementById('glastic-dirty-dot');
    btnSave = document.getElementById('glastic-btn-save');
    btnUndo = document.getElementById('glastic-btn-undo');
    lookList = document.getElementById('glastic-look-list');
  }

  function initUi() {
    PAGES.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.label;
      if (p.path === currentPath) opt.selected = true;
      pageSelect.appendChild(opt);
    });
    pageSelect.onchange = function () { navigateTo(pageSelect.value); };
    document.getElementById('glastic-btn-exit').onclick = function () {
      if (dirty && !confirm('You have unsaved changes. Leave anyway?')) return;
      window.location.href = '/admin/';
    };
    document.getElementById('glastic-btn-colours').onclick = openSheet;
    sheetBackdrop.onclick = closeSheet;
    btnSave.onclick = saveAll;
    btnUndo.onclick = function () {
      if (!undoStack.length) return;
      var snap = undoStack.pop();
      applyDraftSnapshot(snap);
      btnUndo.disabled = undoStack.length === 0;
      setDirty(undoStack.length > 0 || JSON.stringify(draft) !== JSON.stringify(published));
    };
    window.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
    window.__glasticAdminEditBus = onEditBusMessage;
    enableInlineEditWithRetries();
  }

  function showSignInBanner() {
    var banner = document.getElementById('glastic-edit-signin-banner');
    if (banner) banner.hidden = false;
    updateStatusPill('Sign in to edit', 'err');
    logEdit('session', 'unsigned — banner shown');
  }

  function hideSignInBanner() {
    var banner = document.getElementById('glastic-edit-signin-banner');
    if (banner) banner.hidden = true;
  }

  function setDirty(on) {
    dirty = on;
    if (dirtyDot) dirtyDot.style.display = on ? 'block' : 'none';
    if (btnSave) btnSave.disabled = saving;
  }

  async function startEditor() {
    window.__GLASTIC_EDIT_SESSION_OK = true;
    hideSignInBanner();
    logEdit('startEditor', 'loading shop data');
    showLoading('Loading your website…');
    var bootTimer = setTimeout(function () {
      logEdit('timeout', 'boot exceeded ' + BOOT_TIMEOUT_MS + 'ms');
      showErrorPanel('Loading timed out', 'Loading shop data took too long. Check your connection and try again.');
    }, BOOT_TIMEOUT_MS);
    try {
      await loadData();
      gate.hidden = true;
      initUi();
      window.__editEditorBooted = true;
      logEdit('ready');
    } catch (err) {
      showErrorPanel('Could not load editor', (err && err.message)
        || 'Something went wrong loading your shop data.');
    } finally {
      clearTimeout(bootTimer);
    }
  }

  async function boot() {
    injectChrome();
    window.__glasticAdminEditBus = onEditBusMessage;
    showLoading('Checking sign-in…');
    logEdit('boot', 'auth check');
    try {
      var state = await api('/api/admin/auth', { timeoutMs: AUTH_TIMEOUT_MS });
      if (state.needsDatabase) {
        showErrorPanel('Database not connected', 'Ask your developer to connect Neon in Vercel, then try again.');
        return;
      }
      if (!state.signedIn) {
        showSignInForm(state.needsSetup);
        window.__editEditorBooted = true;
        return;
      }
      window.__GLASTIC_EDIT_SESSION_OK = true;
      logEdit('session', 'signed in');
      await startEditor();
    } catch (err) {
      if (err && err.needsDatabase) {
        showErrorPanel('Database not connected', 'Ask your developer to connect Neon in Vercel, then try again.');
        return;
      }
      showErrorPanel('Could not open editor', (err && err.message) || 'Could not verify sign-in.');
    }
  }

  window.addEventListener('error', function (event) {
    if (window.__editEditorBooted) return;
    showErrorPanel('Editor error', (event && event.message) || 'Something went wrong loading the editor.');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
