(function () {
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
  var iframe = null;
  var currentPath = '/';
  var iframeReady = false;

  var gate = document.getElementById('gate');
  var shell = document.getElementById('shell');
  var pageSelect = document.getElementById('page-select');
  var dirtyDot = document.getElementById('dirty-dot');
  var btnSave = document.getElementById('btn-save');
  var btnUndo = document.getElementById('btn-undo');
  var toast = document.getElementById('toast');
  var lookList = document.getElementById('look-list');
  var colourSheet = document.getElementById('colour-sheet');
  var sheetBackdrop = document.getElementById('sheet-backdrop');

  function api(url, options) {
    return fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    }, options || {})).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), data);
        return data;
      });
    });
  }

  function cloneData(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function previewPayload() {
    return { settings: draft.settings, gallery: draft.gallery };
  }

  function postPreview() {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({
      source: 'glastic-visual-admin',
      type: 'preview',
      settingsPayload: previewPayload(),
      products: draft.products.slice(),
      inlineEdit: true
    }, window.location.origin);
  }

  function enableIframeEdit() {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ source: 'glastic-visual-admin', type: 'enable' }, window.location.origin);
    postPreview();
  }

  function getPath(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'visualEdit=1';
  }

  function loadIframe(path) {
    currentPath = path;
    iframeReady = false;
    if (pageSelect) pageSelect.value = path;
    if (iframe) iframe.src = getPath(path);
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

  function setDirty(on) {
    dirty = on;
    dirtyDot.classList.toggle('on', dirty);
    btnSave.disabled = saving;
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

  function onIframeMessage(event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== 'glastic-visual-edit') return;
    if (data.type === 'iframe-loaded' || data.type === 'ready') {
      iframeReady = true;
      enableIframeEdit();
    }
    if (data.type === 'change') {
      applyChange(data.key, data.value);
    }
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
    var sdata = await api('/api/admin/settings');
    var pdata = await api('/api/admin/products');
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
  }

  function showGate(message, link) {
    gate.hidden = false;
    shell.hidden = true;
    gate.innerHTML = '<div><p>' + message + '</p>'
      + (link ? '<p style="margin-top:1rem"><a href="' + link + '" style="color:#5eead4">Sign in</a></p>' : '')
      + '</div>';
  }

  function initUi() {
    PAGES.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.label;
      pageSelect.appendChild(opt);
    });
    pageSelect.onchange = function () { loadIframe(pageSelect.value); };
    document.getElementById('btn-exit').onclick = function () {
      if (dirty && !confirm('You have unsaved changes. Leave anyway?')) return;
      window.location.href = '/admin/';
    };
    document.getElementById('btn-colours').onclick = openSheet;
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
    window.addEventListener('message', onIframeMessage);
    iframe = document.getElementById('site-frame');
    iframe.onload = function () {
      if (iframeReady) enableIframeEdit();
    };
    loadIframe('/');
  }

  api('/api/admin/auth').then(async function (state) {
    if (state.needsDatabase) {
      showGate('Connect the database before editing.', '/admin/advanced.html');
      return;
    }
    if (!state.signedIn) {
      showGate('Sign in to edit your website.', '/admin/');
      return;
    }
    gate.hidden = true;
    shell.hidden = false;
    await loadData();
    initUi();
  }).catch(function () {
    showGate('Could not verify sign-in.', '/admin/');
  });
})();
