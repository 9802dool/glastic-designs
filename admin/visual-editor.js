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

  var CATEGORIES = ['Tiles', 'Planters', 'Furniture', 'Gifts', 'Services'];

  var published = { settings: null, gallery: [], products: [] };
  var draft = { settings: null, gallery: [], products: [] };
  var meta = { fonts: [], presets: [] };
  var dirty = false;
  var iframe = null;
  var currentPath = '/';
  var selectedKey = '';
  var themeOpen = false;
  var saving = false;

  function api(url, options) {
    return window.adminApi(url, options);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function cloneData(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function darkenHex(hex, amount) {
    var m = String(hex || '').match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
    var g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
    var b = Math.max(0, Math.round((n & 255) * (1 - amount)));
    return '#' + [r, g, b].map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
  }

  function setDirty(on) {
    dirty = on;
    var btn = document.getElementById('ve-discard');
    if (btn) btn.disabled = !dirty;
  }

  function compress(file) {
    return createImageBitmap(file).then(function (bitmap) {
      var max = 1600;
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

  function previewPayload() {
    return {
      settings: draft.settings,
      gallery: draft.gallery
    };
  }

  var iframePreviewReady = false;

  function postPreview() {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({
      source: 'glastic-visual-admin',
      type: 'preview',
      settingsPayload: previewPayload(),
      products: draft.products.filter(function (p) { return !p.hidden; })
    }, window.location.origin);
    if (dirty) {
      var st = document.getElementById('save-status');
      if (st && !saving) {
        st.className = 'wait';
        st.textContent = 'Preview updated — tap Publish changes when ready.';
      }
    }
  }

  function enableIframeEdit() {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ source: 'glastic-visual-admin', type: 'enable' }, window.location.origin);
    postPreview();
  }

  function onPreviewFrameReady() {
    iframePreviewReady = true;
    enableIframeEdit();
  }

  function getPath(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'visualEdit=1';
  }

  function loadIframe(path) {
    currentPath = path;
    iframePreviewReady = false;
    if (!iframe) return;
    iframe.src = getPath(path);
  }

  function getNested(obj, pathParts) {
    var cur = obj;
    for (var i = 0; i < pathParts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[pathParts[i]];
    }
    return cur;
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
    return key.split(/\.(?![^\[]*\])/);
  }

  function fieldHtml(label, id, value, area) {
    if (area) {
      return '<label class="field" for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '">' + esc(value || '') + '</textarea>';
    }
    return '<label class="field" for="' + id + '">' + esc(label) + '</label><input id="' + id + '" value="' + esc(value || '') + '">';
  }

  function bindInput(id, applyFn) {
    var el = document.getElementById(id);
    if (!el) return;
    var evt = el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'url' ? 'input' : 'change';
    el.addEventListener(evt, function () {
      applyFn(el.value);
      setDirty(true);
      postPreview();
    });
  }

  function renderEditPanel(container, key, label) {
    selectedKey = key;
    var html = '<p class="eyebrow">Editing</p><h2 style="margin:0 0 0.75rem;font-size:1.1rem">' + esc(label) + '</h2>';
    var s = draft.settings;
    var hp = s.homepage;

    if (key === 'banner') {
      html += '<label class="row" style="justify-content:space-between;margin:0.5rem 0"><span>Show banner</span>'
        + '<input type="checkbox" id="ve-banner-on"' + (s.banner.enabled ? ' checked' : '') + '></label>'
        + fieldHtml('Banner text', 've-banner-text', s.banner.text)
        + fieldHtml('Link (optional)', 've-banner-link', s.banner.link);
    } else if (key === 'theme.logo') {
      html += '<img class="thumb" src="' + esc(s.theme.logoUrl || '/logo.jpg') + '" alt="" style="width:6rem;height:6rem">'
        + '<label class="primary file-btn" style="margin-top:0.6rem">Upload logo<input type="file" accept="image/*" hidden id="ve-logo-file"></label>'
        + '<p class="muted hint">Logo uploads when you tap Publish.</p>';
    } else if (key.indexOf('homepage.') === 0) {
      var rest = key.slice('homepage.'.length);
      if (rest.indexOf('processSteps.') === 0) {
        var idx = Number(rest.split('.')[1]);
        var step = (hp.processSteps || [])[idx] || { title: '', text: '' };
        html += fieldHtml('Step title', 've-step-title', step.title)
          + fieldHtml('Step description', 've-step-text', step.text, true);
      } else if (rest === 'heroImage' || rest === 'aboutImage') {
        var url = rest === 'heroImage' ? hp.heroImage : hp.aboutImage;
        html += '<img class="photo-card preview" src="' + esc(url) + '" alt="" style="height:10rem">'
          + '<label class="primary file-btn">Change photo<input type="file" accept="image/*" hidden id="ve-img-file"></label>'
          + '<p class="muted hint">Photo uploads when you tap Publish.</p>';
      } else if (rest === 'heroFacebook') {
        html += fieldHtml('Button link (Facebook or other URL)', 've-hero-fb', s.contact.facebook);
      } else {
        var map = {
          heroBadge: 'Badge line',
          heroHeadline: 'Headline (Enter for new line)',
          heroSubtext: 'Intro text',
          heroBadgeNote: 'Photo badge note',
          heroBadgeCaption: 'Photo badge caption',
          aboutEyebrow: 'Eyebrow',
          aboutTitle: 'Title',
          aboutText: 'Story'
        };
        var area = rest === 'heroHeadline' || rest === 'heroSubtext' || rest === 'aboutText';
        html += fieldHtml(map[rest] || rest, 've-hp-field', hp[rest], area);
      }
    } else if (key.indexOf('gallery.') === 0) {
      if (key === 'gallery.title' || key === 'gallery.subtitle') {
        var gk = key.split('.')[1];
        html += fieldHtml(gk === 'title' ? 'Gallery title' : 'Gallery subtitle', 've-gal-meta', s.gallery[gk], gk === 'subtitle');
      } else if (key.indexOf('gallery.item.') === 0) {
        var gid = key.slice('gallery.item.'.length);
        var item = draft.gallery.find(function (g) { return g.id === gid; });
        html += '<img class="photo-card preview" src="' + esc(item ? item.url : '') + '" alt="" style="height:10rem">'
          + fieldHtml('Caption', 've-gal-cap', item ? item.caption : '')
          + '<label class="primary file-btn">Replace photo<input type="file" accept="image/*" hidden id="ve-gal-file"></label>'
          + '<p class="muted hint">New photo uploads when you tap Publish.</p>';
      }
    } else if (key.indexOf('impact.') === 0) {
      if (key === 'impact.title') {
        html += fieldHtml('Section title', 've-impact-title', s.impact.title);
      } else if (key.indexOf('impact.bullets.') === 0) {
        var bi = Number(key.split('.')[2]);
        html += fieldHtml('Bullet point', 've-impact-bullet', (s.impact.bullets || [])[bi], true);
      } else if (key.indexOf('impact.stats.') === 0) {
        var si = Number(key.split('.')[2]);
        var stat = (s.impact.stats || [])[si] || { value: '', label: '' };
        html += '<div class="split">' + fieldHtml('Number', 've-stat-val', stat.value).replace('class="field"', 'class="field" style="margin-top:0"')
          + fieldHtml('Label', 've-stat-label', stat.label).replace('class="field"', 'class="field" style="margin-top:0"') + '</div>';
      }
    } else if (key.indexOf('contact.') === 0) {
      var ck = key.split('.')[1];
      var labels = {
        contactTitle: 'Page title',
        contactLead: 'Intro text',
        whatsapp: 'WhatsApp number',
        facebook: 'Facebook URL',
        instagram: 'Instagram URL',
        youtube: 'YouTube URL',
        tiktok: 'TikTok URL'
      };
      html += fieldHtml(labels[ck] || ck, 've-contact-field', s.contact[ck], ck === 'contactLead');
    } else if (key.indexOf('product.') === 0) {
      var pid = key.slice('product.'.length);
      var product = draft.products.find(function (p) { return p.id === pid; });
      if (!product) {
        html += '<p class="muted">Product not found.</p>';
      } else {
        var chips = CATEGORIES.map(function (name) {
          var on = product.category === name ? ' chip-on' : '';
          return '<button type="button" class="' + on + '" data-ve-cat="' + esc(name) + '">' + esc(name) + '</button>';
        }).join('');
        var photo = (product.photos || []).find(function (p) { return p.isMain; }) || (product.photos || [])[0];
        html += fieldHtml('Name', 've-prod-name', product.name)
          + fieldHtml('Price (TTD)', 've-prod-price', product.priceTtd)
          + fieldHtml('Description', 've-prod-desc', product.description, true)
          + '<p class="field">Category</p><div class="chips">' + chips + '</div>'
          + (photo ? '<img class="photo-card preview" src="' + esc(photo.url) + '" alt="" style="height:10rem;margin-top:0.5rem">' : '')
          + '<label class="primary file-btn">Change main photo<input type="file" accept="image/*" hidden id="ve-prod-file"></label>'
          + '<label class="row" style="justify-content:space-between;margin:0.75rem 0"><span>Hide from website</span>'
          + '<input type="checkbox" id="ve-prod-hidden"' + (product.hidden ? ' checked' : '') + '></label>'
          + '<p class="muted hint">Product photo uploads when you tap Publish.</p>';
      }
    } else {
      html += '<p class="muted">Tap something on the page to edit it.</p>';
    }

    html += '<button type="button" class="quiet" id="ve-close-panel" style="margin-top:1rem">Close</button>';
    container.innerHTML = html;
    container.hidden = false;

    document.getElementById('ve-close-panel').onclick = function () {
      container.hidden = true;
      selectedKey = '';
    };

    if (key === 'banner') {
      document.getElementById('ve-banner-on').onchange = function (e) {
        draft.settings.banner.enabled = e.target.checked;
        setDirty(true);
        postPreview();
      };
      bindInput('ve-banner-text', function (v) { draft.settings.banner.text = v; });
      bindInput('ve-banner-link', function (v) { draft.settings.banner.link = v; });
    } else if (key === 'theme.logo') {
      document.getElementById('ve-logo-file').onchange = handlePendingImage('logo');
    } else if (key.indexOf('homepage.') === 0) {
      var rest2 = key.slice('homepage.'.length);
      if (rest2.indexOf('processSteps.') === 0) {
        var idx2 = Number(rest2.split('.')[1]);
        bindInput('ve-step-title', function (v) {
          draft.settings.homepage.processSteps[idx2].title = v;
        });
        bindInput('ve-step-text', function (v) {
          draft.settings.homepage.processSteps[idx2].text = v;
        });
      } else if (rest2 === 'heroImage') {
        document.getElementById('ve-img-file').onchange = handlePendingImage('hero-image');
      } else if (rest2 === 'aboutImage') {
        document.getElementById('ve-img-file').onchange = handlePendingImage('about-image');
      } else if (rest2 === 'heroFacebook') {
        bindInput('ve-hero-fb', function (v) { draft.settings.contact.facebook = v; });
      } else {
        bindInput('ve-hp-field', function (v) { draft.settings.homepage[rest2] = v; });
      }
    } else if (key === 'gallery.title' || key === 'gallery.subtitle') {
      var gk2 = key.split('.')[1];
      bindInput('ve-gal-meta', function (v) { draft.settings.gallery[gk2] = v; });
    } else if (key.indexOf('gallery.item.') === 0) {
      var gid2 = key.slice('gallery.item.'.length);
      bindInput('ve-gal-cap', function (v) {
        var item = draft.gallery.find(function (g) { return g.id === gid2; });
        if (item) item.caption = v;
      });
      document.getElementById('ve-gal-file').onchange = function (e) {
        var file = (e.target.files || [])[0];
        e.target.value = '';
        if (!file) return;
        compress(file).then(blobToBase64).then(function (data) {
          window.__vePendingUploads = window.__vePendingUploads || [];
          window.__vePendingUploads.push({ action: 'gallery-replace', id: gid2, data: data, caption: document.getElementById('ve-gal-cap').value });
          var item = draft.gallery.find(function (g) { return g.id === gid2; });
          if (item) item.url = URL.createObjectURL(file);
          setDirty(true);
          postPreview();
        }).catch(showError);
      };
    } else if (key === 'impact.title') {
      bindInput('ve-impact-title', function (v) { draft.settings.impact.title = v; });
    } else if (key.indexOf('impact.bullets.') === 0) {
      var bi2 = Number(key.split('.')[2]);
      bindInput('ve-impact-bullet', function (v) {
        draft.settings.impact.bullets[bi2] = v;
      });
    } else if (key.indexOf('impact.stats.') === 0) {
      var si2 = Number(key.split('.')[2]);
      bindInput('ve-stat-val', function (v) { draft.settings.impact.stats[si2].value = v; });
      bindInput('ve-stat-label', function (v) { draft.settings.impact.stats[si2].label = v; });
    } else if (key.indexOf('contact.') === 0) {
      var ck2 = key.split('.')[1];
      bindInput('ve-contact-field', function (v) { draft.settings.contact[ck2] = v; });
    } else if (key.indexOf('product.') === 0) {
      var pid2 = key.slice('product.'.length);
      var prod = draft.products.find(function (p) { return p.id === pid2; });
      bindInput('ve-prod-name', function (v) { prod.name = v; });
      bindInput('ve-prod-price', function (v) { prod.priceTtd = v; });
      bindInput('ve-prod-desc', function (v) { prod.description = v; });
      document.querySelectorAll('[data-ve-cat]').forEach(function (btn) {
        btn.onclick = function () {
          prod.category = btn.getAttribute('data-ve-cat');
          setDirty(true);
          postPreview();
          renderEditPanel(container, key, label);
        };
      });
      document.getElementById('ve-prod-hidden').onchange = function (e) {
        prod.hidden = e.target.checked;
        setDirty(true);
        postPreview();
      };
      document.getElementById('ve-prod-file').onchange = function (e) {
        var file = (e.target.files || [])[0];
        e.target.value = '';
        if (!file) return;
        compress(file).then(blobToBase64).then(function (data) {
          window.__vePendingUploads = window.__vePendingUploads || [];
          var main = (prod.photos || []).find(function (p) { return p.isMain; }) || (prod.photos || [])[0];
          window.__vePendingUploads.push({ action: 'product-photo', productId: pid2, photoId: main ? main.id : null, data: data });
          if (main) main.url = URL.createObjectURL(file);
          setDirty(true);
          postPreview();
        }).catch(showError);
      };
    }
  }

  function handlePendingImage(kind) {
    return function (e) {
      var file = (e.target.files || [])[0];
      e.target.value = '';
      if (!file) return;
      compress(file).then(blobToBase64).then(function (data) {
        window.__vePendingUploads = window.__vePendingUploads || [];
        window.__vePendingUploads.push({ action: kind, data: data });
        var url = URL.createObjectURL(file);
        if (kind === 'logo') draft.settings.theme.logoUrl = url;
        if (kind === 'hero-image') draft.settings.homepage.heroImage = url;
        if (kind === 'about-image') draft.settings.homepage.aboutImage = url;
        setDirty(true);
        postPreview();
      }).catch(showError);
    };
  }

  function renderThemeDrawer(el) {
    var theme = draft.settings.theme;
    var presetButtons = meta.presets.map(function (p) {
      var on = theme.preset === p.id ? ' chip-on' : '';
      return '<button type="button" class="' + on + '" data-ve-preset="' + esc(p.id) + '">' + esc(p.label) + '</button>';
    }).join('');
    var fontOptions = meta.fonts.map(function (f) {
      return '<option value="' + esc(f.id) + '"' + (theme.fontId === f.id ? ' selected' : '') + '>' + esc(f.label) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Site look</h2><p class="muted hint">Changes show live in the preview.</p>'
      + '<p class="field">Theme preset</p><div class="chips">' + presetButtons + '</div>'
      + '<div class="split"><label class="field">Primary<input type="color" id="ve-color-primary" value="' + esc(theme.primary) + '"></label>'
      + '<label class="field">Accent<input type="color" id="ve-color-accent" value="' + esc(theme.accent) + '"></label></div>'
      + '<label class="field" for="ve-font">Fonts</label><select id="ve-font">' + fontOptions + '</select>'
      + '<h2 style="margin-top:1rem">Sections on the website</h2>'
      + sectionToggle('hero', 'Hero')
      + sectionToggle('about', 'About')
      + sectionToggle('gallery', 'Gallery')
      + sectionToggle('products', 'Products')
      + sectionToggle('process', 'How we make it')
      + sectionToggle('impact', 'Impact')
      + sectionToggle('contact', 'Contact')
      + sectionToggle('consultation', 'Consultation box')
      + '<button type="button" class="ghost" id="ve-edit-banner" style="margin-top:0.75rem;width:100%">Edit announcement banner</button>';
    el.querySelectorAll('[data-ve-preset]').forEach(function (btn) {
      btn.onclick = function () {
        var preset = meta.presets.find(function (p) { return p.id === btn.getAttribute('data-ve-preset'); });
        if (!preset) return;
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
        renderThemeDrawer(el);
      };
    });
    ['ve-color-primary', 've-color-accent'].forEach(function (id) {
      var input = document.getElementById(id);
      input.oninput = function () {
        if (id === 've-color-primary') {
          draft.settings.theme.primary = input.value;
          draft.settings.theme.primaryDark = darkenHex(input.value, 0.22) || input.value;
        } else draft.settings.theme.accent = input.value;
        setDirty(true);
        postPreview();
      };
    });
    document.getElementById('ve-font').onchange = function (e) {
      draft.settings.theme.fontId = e.target.value;
      setDirty(true);
      postPreview();
    };
    el.querySelectorAll('[data-ve-vis]').forEach(function (input) {
      input.onchange = function () {
        draft.settings.visibility[input.getAttribute('data-ve-vis')] = input.checked;
        setDirty(true);
        postPreview();
      };
    });
    document.getElementById('ve-edit-banner').onclick = function () {
      renderEditPanel(document.getElementById('ve-edit-panel'), 'banner', 'Announcement banner');
    };
  }

  function sectionToggle(key, label) {
    var on = draft.settings.visibility[key] !== false;
    return '<label class="row" style="justify-content:space-between;margin:0.35rem 0"><span>' + esc(label) + '</span>'
      + '<input type="checkbox" data-ve-vis="' + esc(key) + '"' + (on ? ' checked' : '') + '></label>';
  }

  function showError(err) {
    var st = document.getElementById('save-status');
    st.className = 'bad';
    st.textContent = (err && err.message) || 'Something went wrong.';
  }

  async function flushPendingUploads() {
    var queue = window.__vePendingUploads || [];
    window.__vePendingUploads = [];
    for (var i = 0; i < queue.length; i++) {
      var job = queue[i];
      if (job.action === 'logo') {
        var r = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'logo', data: job.data }) });
        draft.settings = r.settings;
      } else if (job.action === 'hero-image') {
        var r2 = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'hero-image', data: job.data }) });
        draft.settings = r2.settings;
      } else if (job.action === 'about-image') {
        var r3 = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'about-image', data: job.data }) });
        draft.settings = r3.settings;
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
    var data = await api('/api/admin/settings');
    draft.settings = data.settings;
    draft.gallery = data.gallery || draft.gallery;
    var pdata = await api('/api/admin/products');
    draft.products = pdata.products || draft.products;
  }

  async function publish() {
    if (saving) return;
    saving = true;
    var saveBtn = document.getElementById('save-button');
    var saveStatus = document.getElementById('save-status');
    saveBtn.disabled = true;
    saveStatus.className = 'wait';
    saveStatus.textContent = 'Publishing…';
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
      setDirty(false);
      saveStatus.className = 'ok';
      saveStatus.textContent = 'Saved! Your website is live with these changes.';
      postPreview();
      if (window.adminRefreshProducts) window.adminRefreshProducts(draft.products);
    } catch (error) {
      showError(error);
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  }

  function discard() {
    if (!dirty || !confirm('Discard all unsaved changes?')) return;
    draft = {
      settings: cloneData(published.settings),
      gallery: cloneData(published.gallery),
      products: cloneData(published.products)
    };
    window.__vePendingUploads = [];
    setDirty(false);
    postPreview();
    document.getElementById('save-status').className = 'ok';
    document.getElementById('save-status').textContent = 'Changes discarded.';
    if (themeOpen) renderThemeDrawer(document.getElementById('ve-theme-drawer'));
    postPreview();
  }

  function renderShell(container, savebar, saveStatus, saveButton, titleEl) {
    titleEl.textContent = 'Edit my website';
    document.body.classList.add('editing', 'visual-editing');
    savebar.hidden = false;
    saveButton.textContent = 'Publish changes';
    saveButton.removeAttribute('form');
    saveButton.onclick = publish;

    var pageChips = PAGES.map(function (p) {
      var on = p.path === currentPath ? ' chip-on' : '';
      return '<button type="button" class="' + on + '" data-ve-page="' + esc(p.path) + '">' + esc(p.label) + '</button>';
    }).join('');

    container.innerHTML = '<button class="quiet" type="button" id="ve-back">← Back to advanced</button>'
      + '<p class="muted hint">Tap anything on your site to edit it. Use <strong>Site look</strong> for colours and which sections show.</p>'
      + '<div class="ve-toolbar">'
      + '<nav class="admin-tabs ve-pages" aria-label="Pages">' + pageChips + '</nav>'
      + '<button type="button" class="ghost" id="ve-theme-toggle">Site look</button>'
      + '</div>'
      + '<div class="ve-layout">'
      + '<div class="ve-frame-wrap"><iframe id="ve-iframe" title="Website preview" class="ve-iframe"></iframe></div>'
      + '<aside id="ve-theme-drawer" class="ve-theme-drawer" hidden></aside>'
      + '<aside id="ve-edit-panel" class="ve-edit-panel" hidden></aside>'
      + '</div>'
      + '<button type="button" class="ghost" id="ve-discard" disabled>Discard changes</button>';

    iframe = document.getElementById('ve-iframe');
    iframe.onload = enableIframeEdit;
    loadIframe(currentPath);

    document.getElementById('ve-back').onclick = function () {
      if (dirty && !confirm('You have unpublished changes. Leave anyway?')) return;
      document.body.classList.remove('visual-editing');
      window.adminShowProducts();
    };
    document.getElementById('ve-discard').onclick = discard;
    document.getElementById('ve-theme-toggle').onclick = function () {
      themeOpen = !themeOpen;
      var drawer = document.getElementById('ve-theme-drawer');
      drawer.hidden = !themeOpen;
      if (themeOpen) renderThemeDrawer(drawer);
    };
    container.querySelectorAll('[data-ve-page]').forEach(function (btn) {
      btn.onclick = function () {
        loadIframe(btn.getAttribute('data-ve-page'));
        container.querySelectorAll('[data-ve-page]').forEach(function (b) {
          b.classList.toggle('chip-on', b === btn);
        });
      };
    });

    renderThemeDrawer(document.getElementById('ve-theme-drawer'));
    document.getElementById('ve-theme-drawer').hidden = !themeOpen;

    window.addEventListener('message', onIframeMessage);
  }

  function onIframeMessage(event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== 'glastic-visual-edit') return;
    if (data.type === 'iframe-loaded' || data.type === 'ready') {
      onPreviewFrameReady();
    }
    if (data.type === 'select') {
      renderEditPanel(document.getElementById('ve-edit-panel'), data.key, data.label);
    }
  }

  async function loadData() {
    var sdata = await api('/api/admin/settings');
    var pdata = await api('/api/admin/products');
    meta.fonts = (sdata.meta && sdata.meta.fonts) || sdata.fonts || [];
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
    setDirty(false);
  }

  window.adminShowVisualEditor = async function () {
    currentPath = '/';
    themeOpen = true;
    selectedKey = '';
    await loadData();
    renderShell(
      document.getElementById('app'),
      document.getElementById('savebar'),
      document.getElementById('save-status'),
      document.getElementById('save-button'),
      document.getElementById('title')
    );
    document.getElementById('save-status').textContent = dirty ? '' : 'Tap the page to edit. Publish when you are happy.';
    document.getElementById('save-status').className = '';
  };
})();
