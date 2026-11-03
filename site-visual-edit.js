(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('visualEdit') !== '1') return;

  var HINT_KEY = 'glastic-inline-edit-hint-v1';
  var active = false;
  var popover = null;
  var fileInput = null;
  var editingEl = null;

  var STATIC_TARGETS = [
    { selector: '#site-banner', key: 'banner.text', kind: 'text', route: ['home'] },
    { selector: '#site-logo', key: 'theme.logoUrl', kind: 'image' },
    { selector: '#hero-badge', key: 'homepage.heroBadge', kind: 'text', route: ['home'] },
    { selector: '#hero-headline', key: 'homepage.heroHeadline', kind: 'multiline', route: ['home'] },
    { selector: '#hero-subtext', key: 'homepage.heroSubtext', kind: 'multiline', route: ['home'] },
    { selector: '#hero-image', key: 'homepage.heroImage', kind: 'image', route: ['home'] },
    { selector: '#hero-badge-note', key: 'homepage.heroBadgeNote', kind: 'text', route: ['home'] },
    { selector: '#hero-badge-caption', key: 'homepage.heroBadgeCaption', kind: 'text', route: ['home'] },
    { selector: '#hero-facebook', key: 'homepage.heroFacebook', kind: 'link', route: ['home'] },
    { selector: '#about-eyebrow', key: 'homepage.aboutEyebrow', kind: 'text', route: ['about', 'home'] },
    { selector: '#about-title', key: 'homepage.aboutTitle', kind: 'text', route: ['about', 'home'] },
    { selector: '#about-text', key: 'homepage.aboutText', kind: 'multiline', route: ['about', 'home'] },
    { selector: '#about-image', key: 'homepage.aboutImage', kind: 'image', route: ['about', 'home'] },
    { selector: '#gallery-title', key: 'gallery.title', kind: 'text', route: ['gallery', 'home'] },
    { selector: '#gallery-subtitle', key: 'gallery.subtitle', kind: 'multiline', route: ['gallery', 'home'] },
    { selector: '#impact-title', key: 'impact.title', kind: 'text', route: ['impact', 'home'] },
    { selector: '#contact-title', key: 'contact.contactTitle', kind: 'text', route: ['contact'] },
    { selector: '#contact-lead', key: 'contact.contactLead', kind: 'multiline', route: ['contact'] },
    { selector: '[data-site-wa]', key: 'contact.whatsapp', kind: 'link', route: ['contact', 'home'] },
    { selector: '[data-site-social="facebook"]', key: 'contact.facebook', kind: 'link' },
    { selector: '[data-site-social="instagram"]', key: 'contact.instagram', kind: 'link' },
    { selector: '[data-site-social="youtube"]', key: 'contact.youtube', kind: 'link' },
    { selector: '[data-site-social="tiktok"]', key: 'contact.tiktok', kind: 'link' }
  ];

  function inIframe() {
    try { return window.parent && window.parent !== window; } catch (e) { return false; }
  }

  function postToParent(msg) {
    if (!inIframe()) return;
    window.parent.postMessage(Object.assign({ source: 'glastic-visual-edit' }, msg), window.location.origin);
  }

  function sanitizePlain(text) {
    return String(text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  }

  function routeOk(target) {
    if (!target.route || !target.route.length) return true;
    var route = window.GLASTIC_ROUTE || { id: 'home' };
    return target.route.indexOf(route.id) >= 0;
  }

  function ensureStyles() {
    if (document.getElementById('glastic-inline-edit-css')) return;
    var style = document.createElement('style');
    style.id = 'glastic-inline-edit-css';
    style.textContent = ''
      + 'html.glastic-visual-edit-active [data-editable]{cursor:text;}'
      + 'html.glastic-visual-edit-active [data-editable][data-editable-kind="image"]{cursor:pointer;}'
      + 'html.glastic-visual-edit-active [data-editable][data-editable-kind="link"]{cursor:pointer;}'
      + 'html.glastic-visual-edit-active [data-editable]:hover{outline:2px dashed rgba(20,184,166,.85);outline-offset:3px;}'
      + 'html.glastic-visual-edit-active [data-editable].is-editing{outline:2px solid #0f766e;outline-offset:3px;}'
      + '.glastic-edit-popover{position:fixed;z-index:10001;background:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:0.65rem;min-width:11rem;max-width:min(20rem,calc(100vw - 1.5rem));font:600 0.8125rem Inter,system-ui,sans-serif;color:#1c1917;}'
      + '.glastic-edit-popover button,.glastic-edit-popover input{width:100%;min-height:2.75rem;border-radius:10px;border:1px solid #e7e5e4;padding:0 0.65rem;font:inherit;margin-top:0.35rem;}'
      + '.glastic-edit-popover button.primary{background:#0f766e;color:#fff;border:0;}'
      + '.glastic-edit-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(4.5rem + env(safe-area-inset-bottom));z-index:10000;background:#115e59;color:#fff;padding:0.55rem 1rem;border-radius:999px;font:600 0.8125rem Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);pointer-events:none;}'
      + '.glastic-prod-hide{position:absolute;top:0.5rem;right:0.5rem;z-index:2;background:rgba(255,255,255,.95);border:0;border-radius:999px;padding:0.35rem 0.65rem;font:600 0.75rem Inter,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.12);cursor:pointer;min-height:2.25rem;}'
      + '.product-card.glastic-hidden-preview{opacity:0.55;}'
      + '[contenteditable="true"]:focus{outline:none;}';
    document.head.appendChild(style);
  }

  function markStatic() {
    STATIC_TARGETS.forEach(function (t) {
      if (!routeOk(t)) return;
      document.querySelectorAll(t.selector).forEach(function (el) {
        el.setAttribute('data-editable', t.key);
        el.setAttribute('data-editable-kind', t.kind);
      });
    });
  }

  function markDynamic() {
    document.querySelectorAll('#process-steps > div').forEach(function (step, i) {
      var title = step.querySelector('h3');
      var text = step.querySelector('p');
      if (title) {
        title.setAttribute('data-editable', 'homepage.processSteps.' + i + '.title');
        title.setAttribute('data-editable-kind', 'text');
      }
      if (text) {
        text.setAttribute('data-editable', 'homepage.processSteps.' + i + '.text');
        text.setAttribute('data-editable-kind', 'multiline');
      }
    });
    document.querySelectorAll('#impact-bullets li span').forEach(function (span, i) {
      span.setAttribute('data-editable', 'impact.bullets.' + i);
      span.setAttribute('data-editable-kind', 'multiline');
    });
    document.querySelectorAll('#impact-stats > div').forEach(function (node, i) {
      var val = node.querySelector('.text-4xl');
      var lab = node.querySelector('.text-sm');
      if (val) {
        val.setAttribute('data-editable', 'impact.stats.' + i + '.value');
        val.setAttribute('data-editable-kind', 'text');
      }
      if (lab) {
        lab.setAttribute('data-editable', 'impact.stats.' + i + '.label');
        lab.setAttribute('data-editable-kind', 'text');
      }
    });
    document.querySelectorAll('#gallery-grid figure[data-gallery-id]').forEach(function (fig) {
      var id = fig.getAttribute('data-gallery-id');
      if (!id) return;
      var img = fig.querySelector('img');
      if (img) {
        img.setAttribute('data-editable', 'gallery.item.' + id);
        img.setAttribute('data-editable-kind', 'image');
      }
      var cap = fig.querySelector('figcaption');
      if (cap) {
        cap.setAttribute('data-editable', 'gallery.item.' + id + '.caption');
        cap.setAttribute('data-editable-kind', 'text');
      }
    });
    document.querySelectorAll('.product-card').forEach(function (card) {
      var pid = card.getAttribute('data-product-id');
      if (!pid) return;
      card.classList.toggle('glastic-hidden-preview', card.getAttribute('data-hidden') === '1');
      var photo = card.querySelector('.photo-frame img');
      if (photo) {
        photo.setAttribute('data-editable', 'product.' + pid + '.photoUrl');
        photo.setAttribute('data-editable-kind', 'image');
        photo.setAttribute('data-upload-kind', 'product-photo');
        photo.setAttribute('data-product-id', pid);
        if (window.__GLASTIC_LAST_PRODUCTS) {
          var prod = window.__GLASTIC_LAST_PRODUCTS.find(function (p) { return p.id === pid; });
          if (prod) {
            var mp = (prod.photos || []).find(function (p) { return p.isMain; }) || (prod.photos || [])[0];
            if (mp && mp.id) photo.setAttribute('data-photo-id', mp.id);
          }
        }
      }
      var h3 = card.querySelector('h3');
      if (h3) {
        h3.setAttribute('data-editable', 'product.' + pid + '.name');
        h3.setAttribute('data-editable-kind', 'text');
      }
      var desc = card.querySelector('.text-stone-600');
      if (desc) {
        desc.setAttribute('data-editable', 'product.' + pid + '.description');
        desc.setAttribute('data-editable-kind', 'multiline');
      }
      var price = card.querySelector('.text-emerald-800');
      if (price) {
        price.setAttribute('data-editable', 'product.' + pid + '.priceTtd');
        price.setAttribute('data-editable-kind', 'price');
      }
      if (!card.querySelector('.glastic-prod-hide')) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'glastic-prod-hide';
        btn.setAttribute('data-product-hide', pid);
        btn.textContent = card.getAttribute('data-hidden') === '1' ? 'Hidden – tap to show' : 'Hide from site';
        card.querySelector('.photo-frame').style.position = 'relative';
        card.querySelector('.photo-frame').appendChild(btn);
      }
    });
  }

  function refreshMarks() {
    if (!active) return;
    document.querySelectorAll('[data-editable]').forEach(function (el) {
      el.removeAttribute('data-editable');
      el.removeAttribute('data-editable-kind');
      el.removeAttribute('data-upload-kind');
    });
    document.querySelectorAll('.glastic-prod-hide').forEach(function (b) { b.remove(); });
    markStatic();
    markDynamic();
  }

  window.__glasticVisualEditRefresh = refreshMarks;

  function findEditable(start) {
    var node = start;
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute('data-editable')) return node;
      if (node.getAttribute && node.getAttribute('data-product-hide')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function closePopover() {
    if (popover) popover.remove();
    popover = null;
  }

  function positionPopover(anchor) {
    if (!popover || !anchor) return;
    var r = anchor.getBoundingClientRect();
    var top = Math.min(window.innerHeight - popover.offsetHeight - 8, r.bottom + 8);
    var left = Math.max(8, Math.min(window.innerWidth - popover.offsetWidth - 8, r.left));
    if (top < 8) top = Math.max(8, r.top - popover.offsetHeight - 8);
    popover.style.top = top + 'px';
    popover.style.left = left + 'px';
  }

  function showHintOnce() {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, '1');
    } catch (e) { return; }
    var hint = document.createElement('div');
    hint.className = 'glastic-edit-hint';
    hint.textContent = 'Tap anything to edit';
    document.body.appendChild(hint);
    setTimeout(function () { hint.remove(); }, 4500);
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
          if (!blob) reject(new Error('Could not read photo'));
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

  function uploadKindForKey(key, el) {
    if (el && el.getAttribute('data-upload-kind') === 'product-photo') return 'product-photo';
    if (key === 'theme.logoUrl') return 'logo';
    if (key === 'homepage.heroImage') return 'hero-image';
    if (key === 'homepage.aboutImage') return 'about-image';
    if (key.indexOf('gallery.item.') === 0) return 'gallery-replace';
    if (key.indexOf('product.') === 0 && key.indexOf('.photoUrl') > 0) return 'product-photo';
    return 'hero-image';
  }

  function startImagePopover(el) {
    closePopover();
    popover = document.createElement('div');
    popover.className = 'glastic-edit-popover';
    popover.innerHTML = '<div>Photo</div><button type="button" class="primary" id="glastic-replace-photo">Replace photo</button>';
    document.body.appendChild(popover);
    positionPopover(el);
    popover.querySelector('#glastic-replace-photo').onclick = function () {
      if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.hidden = true;
        document.body.appendChild(fileInput);
      }
      fileInput.onchange = function () {
        var file = (fileInput.files || [])[0];
        fileInput.value = '';
        if (!file) return;
        var key = el.getAttribute('data-editable');
        var kind = uploadKindForKey(key, el);
        compress(file).then(blobToBase64).then(function (data) {
          var previewUrl = URL.createObjectURL(file);
          var job = { action: kind, data: data };
          if (kind === 'gallery-replace') {
            var gid = key.slice('gallery.item.'.length);
            job.id = gid;
            job.caption = '';
            var capEl = document.querySelector('[data-editable="gallery.item.' + gid + '.caption"]');
            if (capEl) job.caption = capEl.textContent;
          } else if (kind === 'product-photo') {
            job.productId = el.getAttribute('data-product-id');
            job.photoId = el.getAttribute('data-photo-id') || null;
          }
          postToParent({ type: 'pending-upload', job: job, key: key, previewUrl: previewUrl });
          if (el.tagName === 'IMG') el.src = previewUrl;
          closePopover();
        }).catch(function () { alert('Could not use that photo.'); });
      };
      fileInput.click();
    };
  }

  function startLinkPopover(el) {
    closePopover();
    var key = el.getAttribute('data-editable');
    var current = key === 'contact.whatsapp'
      ? (el.getAttribute('href') || '').replace(/^https:\/\/wa\.me\//, '')
      : (el.getAttribute('href') || '');
    popover = document.createElement('div');
    popover.className = 'glastic-edit-popover';
    popover.innerHTML = '<label>Link URL<input type="url" id="glastic-link-val" value="' + current.replace(/"/g, '&quot;') + '"></label>'
      + '<button type="button" class="primary" id="glastic-link-save">Done</button>';
    document.body.appendChild(popover);
    positionPopover(el);
    var input = popover.querySelector('#glastic-link-val');
    input.focus();
    popover.querySelector('#glastic-link-save').onclick = function () {
      var val = sanitizePlain(input.value);
      postToParent({ type: 'change', key: key, value: val });
      if (key === 'contact.whatsapp') {
        var digits = val.replace(/\D/g, '');
        el.setAttribute('href', digits ? 'https://wa.me/' + digits : '#');
      } else {
        el.setAttribute('href', val || '#');
      }
      closePopover();
    };
  }

  function finishTextEdit(el, key, kind) {
    if (!el) return;
    el.removeEventListener('blur', onEditBlur, true);
    el.classList.remove('is-editing');
    el.contentEditable = 'false';
    var raw = sanitizePlain(el.innerText);
    if (kind === 'price') {
      var num = parseFloat(raw.replace(/[^0-9.]/g, ''));
      if (!isFinite(num) || num < 0) {
        alert('Enter a valid price number');
        refreshMarks();
        return;
      }
      postToParent({ type: 'change', key: key, value: num });
      el.textContent = '$' + num.toFixed(2) + ' TTD';
    } else if (kind === 'multiline') {
      postToParent({ type: 'change', key: key, value: raw });
      if (key === 'homepage.heroHeadline') {
        el.innerHTML = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      } else {
        el.textContent = raw;
      }
    } else {
      postToParent({ type: 'change', key: key, value: raw });
      el.textContent = raw;
    }
    editingEl = null;
  }

  function onEditBlur(event) {
    if (!editingEl || event.target !== editingEl) return;
    finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
  }

  function startTextEdit(el, kind) {
    if (editingEl === el) return;
    if (editingEl) finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
    closePopover();
    editingEl = el;
    el.classList.add('is-editing');
    el.contentEditable = 'true';
    el.addEventListener('blur', onEditBlur, true);
    if (kind === 'price') {
      el.textContent = el.textContent.replace(/[^0-9.]/g, '');
    }
    el.focus();
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* ignore */ }
  }

  function onPastePlain(e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function onClick(event) {
    if (!active) return;
    var hideBtn = event.target.closest && event.target.closest('[data-product-hide]');
    if (hideBtn) {
      event.preventDefault();
      event.stopPropagation();
      var pid = hideBtn.getAttribute('data-product-hide');
      var card = hideBtn.closest('.product-card');
      var nowHidden = card.getAttribute('data-hidden') !== '1';
      card.setAttribute('data-hidden', nowHidden ? '1' : '0');
      card.classList.toggle('glastic-hidden-preview', nowHidden);
      hideBtn.textContent = nowHidden ? 'Hidden – tap to show' : 'Hide from site';
      postToParent({ type: 'change', key: 'product.' + pid + '.hidden', value: nowHidden });
      return;
    }
    var el = findEditable(event.target);
    if (!el || el === editingEl) return;
    var kind = el.getAttribute('data-editable-kind');
    var key = el.getAttribute('data-editable');
    if (kind === 'image') {
      event.preventDefault();
      event.stopPropagation();
      startImagePopover(el);
      return;
    }
    if (kind === 'link') {
      event.preventDefault();
      event.stopPropagation();
      startLinkPopover(el);
      return;
    }
    if (kind === 'text' || kind === 'multiline' || kind === 'price') {
      event.preventDefault();
      event.stopPropagation();
      startTextEdit(el, kind);
    }
  }

  function onDocumentClick(event) {
    if (!active) return;
    if (popover && !popover.contains(event.target)) closePopover();
    if (editingEl && !editingEl.contains(event.target)) {
      finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
    }
  }

  function onKeyDown(event) {
    if (!editingEl) return;
    if (event.key === 'Escape') {
      editingEl.blur();
      finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
    }
    if (event.key === 'Enter' && editingEl.getAttribute('data-editable-kind') !== 'multiline') {
      event.preventDefault();
      finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
    }
  }

  window.__glasticEnableVisualEdit = enableEditMode;
  window.__glasticDisableVisualEdit = disableEditMode;

  function enableEditMode() {
    if (active) return;
    active = true;
    window.GLASTIC_VISUAL_EDIT_ACTIVE = true;
    document.documentElement.classList.add('glastic-visual-edit-active');
    ensureStyles();
    refreshMarks();
    showHintOnce();
    document.addEventListener('click', onClick, true);
    document.addEventListener('click', onDocumentClick, false);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('paste', onPastePlain, true);
    postToParent({ type: 'ready' });
  }

  function disableEditMode() {
    active = false;
    window.GLASTIC_VISUAL_EDIT_ACTIVE = false;
    document.documentElement.classList.remove('glastic-visual-edit-active');
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('click', onDocumentClick, false);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('paste', onPastePlain, true);
    closePopover();
    if (editingEl) {
      editingEl.contentEditable = 'false';
      editingEl.classList.remove('is-editing');
      editingEl = null;
    }
    document.querySelectorAll('[data-editable]').forEach(function (el) {
      el.removeAttribute('data-editable');
      el.removeAttribute('data-editable-kind');
    });
    document.querySelectorAll('.glastic-prod-hide').forEach(function (b) { b.remove(); });
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== 'glastic-visual-admin') return;
    if (data.type === 'scroll-section' && data.sectionId) {
      var sec = document.getElementById(data.sectionId);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(refreshMarks, 400);
    }
  });

  if (window.__GLASTIC_PENDING_VISUAL_ENABLE) {
    window.__GLASTIC_PENDING_VISUAL_ENABLE = false;
    enableEditMode();
  }
})();
