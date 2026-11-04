(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('visualEdit') !== '1') return;

  var HINT_KEY = 'glastic-inline-edit-hint-v1';
  var active = false;
  var popover = null;
  var fileInput = null;
  var editingEl = null;
  var markObserver = null;
  var remarkTimer = null;

  function veLog(stage, detail) {
    try {
      console.info('[glastic-edit]', 'visual:' + stage, detail !== undefined ? detail : '');
    } catch (e) { /* ignore */ }
  }

  function isSameDocAdmin() {
    try {
      if (window.GLASTIC_ADMIN_SAME_DOC_EDIT) return window.GLASTIC_ADMIN_SAME_DOC_EDIT();
      return params.get('adminEdit') === '1' && window.parent === window;
    } catch (e) {
      return false;
    }
  }

  var STATIC_TARGETS = [
    { selector: '#site-banner', key: 'banner.text', kind: 'text' },
    { selector: '#site-logo', key: 'theme.logoUrl', kind: 'image' },
    { selector: '#site-wordmark', key: 'chrome.wordmark', kind: 'text' },
    { selector: '#hero-badge', key: 'homepage.heroBadge', kind: 'text' },
    { selector: '#hero-headline', key: 'homepage.heroHeadline', kind: 'multiline' },
    { selector: '#hero-subtext', key: 'homepage.heroSubtext', kind: 'multiline' },
    { selector: '#hero-image', key: 'homepage.heroImage', kind: 'image' },
    { selector: '#hero-badge-note', key: 'homepage.heroBadgeNote', kind: 'text' },
    { selector: '#hero-badge-caption', key: 'homepage.heroBadgeCaption', kind: 'text' },
    { selector: '#hero-explore-label', key: 'chrome.heroExploreLabel', kind: 'text' },
    { selector: '#hero-explore-cta', key: 'chrome.heroExploreHref', kind: 'link' },
    { selector: '#hero-facebook', key: 'contact.facebook', kind: 'link' },
    { selector: '#hero-facebook-label', key: 'chrome.heroFacebookLabel', kind: 'text' },
    { selector: '#about-eyebrow', key: 'homepage.aboutEyebrow', kind: 'text' },
    { selector: '#about-title', key: 'homepage.aboutTitle', kind: 'text' },
    { selector: '#about-text', key: 'homepage.aboutText', kind: 'multiline' },
    { selector: '#about-image', key: 'homepage.aboutImage', kind: 'image' },
    { selector: '#about-feature-0-title', key: 'aboutPage.features.0.title', kind: 'text' },
    { selector: '#about-feature-0-text', key: 'aboutPage.features.0.text', kind: 'multiline' },
    { selector: '#about-feature-1-title', key: 'aboutPage.features.1.title', kind: 'text' },
    { selector: '#about-feature-1-text', key: 'aboutPage.features.1.text', kind: 'multiline' },
    { selector: '#about-feature-2-title', key: 'aboutPage.features.2.title', kind: 'text' },
    { selector: '#about-feature-2-text', key: 'aboutPage.features.2.text', kind: 'multiline' },
    { selector: '#about-plant-image', key: 'aboutPage.plantImage', kind: 'image' },
    { selector: '#about-plant-caption', key: 'aboutPage.plantCaption', kind: 'text' },
    { selector: '#gallery-title', key: 'gallery.title', kind: 'text' },
    { selector: '#gallery-subtitle', key: 'gallery.subtitle', kind: 'multiline' },
    { selector: '#products-lead', key: 'shop.lead', kind: 'multiline' },
    { selector: '#products-demo-note', key: 'shop.demoNote', kind: 'text' },
    { selector: '#process-page-title', key: 'processPage.title', kind: 'text' },
    { selector: '#impact-title', key: 'impact.title', kind: 'text' },
    { selector: '#contact-title', key: 'contact.contactTitle', kind: 'text' },
    { selector: '#contact-lead', key: 'contact.contactLead', kind: 'multiline' },
    { selector: '#contact-email', key: 'contact.email', kind: 'text' },
    { selector: '#contact-hours', key: 'contact.hours', kind: 'text' },
    { selector: '#consult-eyebrow', key: 'consultation.eyebrow', kind: 'text' },
    { selector: '#consult-title', key: 'consultation.title', kind: 'text' },
    { selector: '#consult-lead', key: 'consultation.lead', kind: 'multiline' },
    { selector: '#consult-deposit-amount', key: 'consultation.depositAmount', kind: 'text' },
    { selector: '#consult-deposit-label', key: 'consultation.depositLabel', kind: 'text' },
    { selector: '#consult-pay-button', key: 'consultation.payButton', kind: 'text' },
    { selector: '#consult-wa-button', key: 'consultation.waButton', kind: 'text' },
    { selector: '#consult-note', key: 'consultation.note', kind: 'text' },
    { selector: '#contact-facebook-label', key: 'chrome.contactFacebookLabel', kind: 'text' },
    { selector: '#cart-page-title', key: 'cartPage.title', kind: 'text' },
    { selector: '#cart-page-intro', key: 'cartPage.intro', kind: 'multiline' },
    { selector: '#cart-empty-text', key: 'cartPage.emptyText', kind: 'multiline' },
    { selector: '#cart-subtotal-label', key: 'cartPage.subtotalLabel', kind: 'text' },
    { selector: '#cart-checkout-button', key: 'cartPage.checkoutButton', kind: 'text' },
    { selector: '#cart-checkout-note', key: 'cartPage.checkoutNote', kind: 'text' },
    { selector: '#cart-continue-label', key: 'cartPage.continueLabel', kind: 'text' },
    { selector: '#footer-brand', key: 'footer.brand', kind: 'text' },
    { selector: '#footer-tagline', key: 'footer.tagline', kind: 'multiline' },
    { selector: '#footer-subline', key: 'footer.subline', kind: 'multiline' },
    { selector: '#footer-copyright', key: 'footer.copyright', kind: 'text' },
    { selector: '[data-site-wa]', key: 'contact.whatsapp', kind: 'link' },
    { selector: '[data-site-social="facebook"]', key: 'contact.facebook', kind: 'link' },
    { selector: '[data-site-social="instagram"]', key: 'contact.instagram', kind: 'link' },
    { selector: '[data-site-social="youtube"]', key: 'contact.youtube', kind: 'link' },
    { selector: '[data-site-social="tiktok"]', key: 'contact.tiktok', kind: 'link' }
  ];

  function inIframe() {
    try { return window.parent && window.parent !== window; } catch (e) { return false; }
  }

  function postToParent(msg) {
    var payload = Object.assign({ source: 'glastic-visual-edit' }, msg);
    if (window.__glasticAdminEditBus) {
      window.__glasticAdminEditBus(payload);
      return;
    }
    if (!inIframe()) return;
    window.parent.postMessage(payload, window.location.origin);
  }

  function sanitizePlain(text) {
    return String(text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  }

  function ensureStyles() {
    if (document.getElementById('glastic-inline-edit-css')) return;
    var style = document.createElement('style');
    style.id = 'glastic-inline-edit-css';
    style.textContent = ''
      + 'html.glastic-visual-edit-active [data-editable]{cursor:text;outline:2px dashed rgba(20,184,166,.55);outline-offset:3px;}'
      + 'html.glastic-visual-edit-active [data-editable][data-editable-kind="image"]{cursor:pointer;}'
      + 'html.glastic-visual-edit-active [data-editable][data-editable-kind="link"]{cursor:pointer;}'
      + 'html.glastic-visual-edit-active [data-editable]:hover{outline:2px dashed rgba(20,184,166,.95);outline-offset:3px;}'
      + 'html.glastic-visual-edit-active [data-editable].is-editing{outline:2px solid #0f766e;outline-offset:3px;}'
      + '.glastic-edit-popover{position:fixed;z-index:10001;background:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:0.65rem;min-width:11rem;max-width:min(20rem,calc(100vw - 1.5rem));font:600 0.8125rem Inter,system-ui,sans-serif;color:#1c1917;}'
      + '.glastic-edit-popover button,.glastic-edit-popover input{width:100%;min-height:2.75rem;border-radius:10px;border:1px solid #e7e5e4;padding:0 0.65rem;font:inherit;margin-top:0.35rem;}'
      + '.glastic-edit-popover button.primary{background:#0f766e;color:#fff;border:0;}'
      + '.glastic-link-chip{display:flex;flex-direction:column;gap:0.35rem;}'
      + '.glastic-link-chip button{margin-top:0;border:1px solid #e7e5e4;background:#fafaf9;}'
      + '.glastic-link-chip button.primary{margin-top:0.15rem;}'
      + 'html.glastic-visual-edit-active a[data-nav-label]{cursor:pointer;}'
      + '.glastic-nav-rename-btn{display:inline-flex;align-items:center;justify-content:center;margin-left:0.2rem;width:1.35rem;height:1.35rem;padding:0;border:0;border-radius:999px;background:rgba(15,118,110,.12);color:#0f766e;font-size:0.65rem;line-height:1;cursor:pointer;vertical-align:middle;opacity:0;pointer-events:none;transition:opacity .15s;}'
      + 'html.glastic-visual-edit-active a[data-nav-label]:hover .glastic-nav-rename-btn,html.glastic-visual-edit-active a[data-nav-label]:focus-within .glastic-nav-rename-btn,.glastic-nav-rename-btn:focus{opacity:1;pointer-events:auto;}'
      + '@media (hover:none){html.glastic-visual-edit-active .glastic-nav-rename-btn{opacity:1;pointer-events:auto;}}'
      + '.glastic-edit-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(4.5rem + env(safe-area-inset-bottom));z-index:10000;background:#115e59;color:#fff;padding:0.55rem 1rem;border-radius:999px;font:600 0.8125rem Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);pointer-events:none;}'
      + '.glastic-prod-hide{position:absolute;top:0.5rem;right:0.5rem;z-index:2;background:rgba(255,255,255,.95);border:0;border-radius:999px;padding:0.35rem 0.65rem;font:600 0.75rem Inter,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.12);cursor:pointer;min-height:2.25rem;}'
      + '.product-card.glastic-hidden-preview{opacity:0.55;}'
      + '[contenteditable="true"]:focus{outline:none;}';
    document.head.appendChild(style);
  }

  function markStatic() {
    STATIC_TARGETS.forEach(function (t) {
      document.querySelectorAll(t.selector).forEach(function (el) {
        el.setAttribute('data-editable', t.key);
        el.setAttribute('data-editable-kind', t.kind);
      });
    });
    markNavRenameControls();
    var exploreCta = document.getElementById('hero-explore-cta');
    if (exploreCta) {
      exploreCta.setAttribute('data-editable-label', 'chrome.heroExploreLabel');
    }
  }

  function markNavRenameControls() {
    document.querySelectorAll('[data-nav-label]').forEach(function (anchor) {
      if (!anchor.querySelector('.glastic-nav-rename-btn')) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'glastic-nav-rename-btn';
        btn.setAttribute('aria-label', 'Rename menu label');
        btn.textContent = '\u270E';
        anchor.appendChild(btn);
      }
    });
  }

  function isSiteNavLink(el) {
    if (!el || !el.closest) return false;
    var a = el.closest('a[href]');
    if (!a) return false;
    if (a.hasAttribute('data-nav') || a.hasAttribute('data-nav-label')) return true;
    if (a.closest('#mobile-menu, .cat-tabs, .tabbar, nav')) return true;
    return false;
  }

  function elementEditPlain(el) {
    if (!el) return '';
    if (el.querySelector('.glastic-nav-rename-btn')) {
      var clone = el.cloneNode(true);
      clone.querySelectorAll('.glastic-nav-rename-btn').forEach(function (b) { b.remove(); });
      return sanitizePlain(clone.textContent);
    }
    return sanitizePlain(el.innerText);
  }

  function labelKeyForLink(el) {
    var labelSel = el.getAttribute('data-editable-label');
    if (labelSel) return labelSel;
    var inner = el.querySelector('[data-editable-kind="text"]');
    if (inner) return inner.getAttribute('data-editable');
    return null;
  }

  function navigateWithEditParams(href) {
    if (!href || href.charAt(0) === '#') return;
    try {
      var url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      url.searchParams.set('adminEdit', '1');
      url.searchParams.set('visualEdit', '1');
      window.location.href = url.pathname + url.search + url.hash;
    } catch (e) { /* ignore */ }
  }

  function markShopTitles() {
    var title = document.getElementById('products-title');
    if (!title) return;
    var route = window.GLASTIC_ROUTE || { id: 'home' };
    if (route.id === 'category' && route.category) {
      title.setAttribute('data-editable', 'shop.categoryTitles.' + route.category);
    } else {
      title.setAttribute('data-editable', 'shop.title');
    }
    title.setAttribute('data-editable-kind', 'text');
    var lead = document.getElementById('products-lead');
    if (lead && route.id === 'category' && route.category) {
      lead.setAttribute('data-editable', 'shop.categoryBlurbs.' + route.category);
      lead.setAttribute('data-editable-kind', 'multiline');
    }
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

  function markProductDetailPages() {
    document.querySelectorAll('.product-page').forEach(function (page) {
      var pid = page.id ? page.id.replace(/^page-/, '') : '';
      if (!pid) return;
      var h1 = page.querySelector('h1');
      if (h1) {
        h1.setAttribute('data-editable', 'product.' + pid + '.name');
        h1.setAttribute('data-editable-kind', 'text');
      }
      var desc = page.querySelector('.product-description');
      if (desc) {
        desc.setAttribute('data-editable', 'product.' + pid + '.description');
        desc.setAttribute('data-editable-kind', 'multiline');
      }
      var price = page.querySelector('.product-detail .text-emerald-800');
      if (price) {
        price.setAttribute('data-editable', 'product.' + pid + '.priceTtd');
        price.setAttribute('data-editable-kind', 'price');
      }
      var photo = page.querySelector('.product-photo');
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
      page.querySelectorAll('.product-gallery button img').forEach(function (thumb, ti) {
        thumb.setAttribute('data-editable', 'product.' + pid + '.photoUrl');
        thumb.setAttribute('data-editable-kind', 'image');
        thumb.setAttribute('data-upload-kind', 'product-photo');
        thumb.setAttribute('data-product-id', pid);
      });
    });
  }

  var lastMarkCount = -1;

  function refreshMarks() {
    if (!active) return;
    if (markObserver) markObserver.disconnect();
    document.querySelectorAll('[data-editable]').forEach(function (el) {
      el.removeAttribute('data-editable');
      el.removeAttribute('data-editable-kind');
      el.removeAttribute('data-upload-kind');
    });
    document.querySelectorAll('.glastic-prod-hide').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.glastic-nav-rename-btn').forEach(function (b) { b.remove(); });
    markStatic();
    markShopTitles();
    markDynamic();
    markProductDetailPages();
    var count = document.querySelectorAll('[data-editable]').length;
    if (count !== lastMarkCount) {
      lastMarkCount = count;
      veLog('marks', count + ' editable nodes');
    }
    if (markObserver && document.body) {
      markObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.__glasticVisualEditRefresh = refreshMarks;

  function attachMarkObserver() {
    if (markObserver || typeof MutationObserver === 'undefined') return;
    markObserver = new MutationObserver(function () {
      if (!active) return;
      clearTimeout(attachMarkObserver._t);
      attachMarkObserver._t = setTimeout(refreshMarks, 50);
    });
    markObserver.observe(document.body, { childList: true, subtree: true });
    veLog('observer', 'attached');
  }

  function detachMarkObserver() {
    if (markObserver) {
      markObserver.disconnect();
      markObserver = null;
    }
    if (remarkTimer) {
      clearInterval(remarkTimer);
      remarkTimer = null;
    }
  }

  function scheduleRemarkBurst() {
    if (remarkTimer) return;
    var ticks = 0;
    remarkTimer = setInterval(function () {
      ticks += 1;
      if (active) refreshMarks();
      if (ticks >= 8) {
        clearInterval(remarkTimer);
        remarkTimer = null;
      }
    }, 250);
  }

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
    hint.textContent = 'Use Pages menu to switch — tap outlines to edit';
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
    if (key === 'aboutPage.plantImage') return 'about-plant-image';
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

  function startLinkActionChip(linkEl, innerEditable) {
    closePopover();
    var key = linkEl.getAttribute('data-editable') || (innerEditable && innerEditable.getAttribute('data-editable'));
    var labelKey = labelKeyForLink(linkEl);
    popover = document.createElement('div');
    popover.className = 'glastic-edit-popover glastic-link-chip';
    popover.innerHTML = '<div style="margin-bottom:0.15rem">Link</div>'
      + '<button type="button" data-action="go">Go to page</button>'
      + (labelKey ? '<button type="button" data-action="text">Edit text</button>' : '')
      + (key ? '<button type="button" data-action="href">Change link</button>' : '');
    document.body.appendChild(popover);
    positionPopover(linkEl);
    popover.querySelector('[data-action="go"]').onclick = function () {
      closePopover();
      navigateWithEditParams(linkEl.getAttribute('href'));
    };
    var textBtn = popover.querySelector('[data-action="text"]');
    if (textBtn) {
      textBtn.onclick = function () {
        closePopover();
        var labelEl = document.querySelector('[data-editable="' + labelKey + '"]')
          || linkEl.querySelector('[data-editable-kind="text"]');
        if (labelEl) startTextEdit(labelEl, labelEl.getAttribute('data-editable-kind') || 'text');
      };
    }
    var hrefBtn = popover.querySelector('[data-action="href"]');
    if (hrefBtn) {
      hrefBtn.onclick = function () {
        closePopover();
        startLinkPopover(linkEl);
      };
    }
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
    var raw = elementEditPlain(el);
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
    if (el.hasAttribute('data-nav-label')) {
      el.removeAttribute('data-editable');
      el.removeAttribute('data-editable-kind');
    }
    editingEl = null;
  }

  function onEditBlur(event) {
    if (!editingEl || event.target !== editingEl) return;
    finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
  }

  function startNavLabelEdit(anchor, key) {
    if (editingEl === anchor) return;
    if (editingEl) finishTextEdit(editingEl, editingEl.getAttribute('data-editable'), editingEl.getAttribute('data-editable-kind'));
    closePopover();
    editingEl = anchor;
    anchor.setAttribute('data-editable', key);
    anchor.setAttribute('data-editable-kind', 'text');
    anchor.classList.add('is-editing');
    anchor.contentEditable = 'true';
    anchor.addEventListener('blur', onEditBlur, true);
    anchor.focus();
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

  function onCaptureNavigate(event) {
    if (!active) return;
    if (event.target.closest && event.target.closest('#glastic-edit-toolbar, #glastic-edit-gate, .glastic-edit-popover')) return;
    if (isSiteNavLink(event.target)) return;
    var editable = findEditable(event.target);
    if (editable) {
      var kind = editable.getAttribute('data-editable-kind');
      if (kind === 'image') {
        event.preventDefault();
      }
    }
  }

  function onClick(event) {
    if (!active) return;
    var renameBtn = event.target.closest && event.target.closest('.glastic-nav-rename-btn');
    if (renameBtn) {
      event.preventDefault();
      event.stopPropagation();
      var navAnchor = renameBtn.closest('[data-nav-label]');
      if (navAnchor) {
        var navKey = 'nav.' + navAnchor.getAttribute('data-nav-label');
        startNavLabelEdit(navAnchor, navKey);
      }
      return;
    }
    if (isSiteNavLink(event.target)) return;
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
    var linkAnchor = event.target.closest && event.target.closest('a[href]');
    if (linkAnchor && linkAnchor.getAttribute('href') && linkAnchor.getAttribute('href') !== '#') {
      var linkEditable = findEditable(event.target);
      var linkKind = linkEditable && linkEditable.getAttribute('data-editable-kind');
      if (linkKind === 'link' || (linkEditable && linkAnchor.contains(linkEditable))) {
        event.preventDefault();
        event.stopPropagation();
        startLinkActionChip(linkAnchor, linkEditable);
        return;
      }
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
      startLinkActionChip(el.tagName === 'A' ? el : (el.closest('a[href]') || el), el);
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
    if (active) {
      refreshMarks();
      return;
    }
    active = true;
    window.GLASTIC_VISUAL_EDIT_ACTIVE = true;
    document.documentElement.classList.add('glastic-visual-edit-active');
    ensureStyles();
    refreshMarks();
    attachMarkObserver();
    scheduleRemarkBurst();
    showHintOnce();
    document.addEventListener('click', onCaptureNavigate, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('click', onDocumentClick, false);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('paste', onPastePlain, true);
    veLog('enabled', isSameDocAdmin() ? 'same-document' : 'iframe');
    postToParent({ type: 'ready' });
  }

  function disableEditMode() {
    active = false;
    window.GLASTIC_VISUAL_EDIT_ACTIVE = false;
    document.documentElement.classList.remove('glastic-visual-edit-active');
    detachMarkObserver();
    document.removeEventListener('click', onCaptureNavigate, true);
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

  function sessionAllowsEdit() {
    if (!isSameDocAdmin()) return true;
    return window.__GLASTIC_EDIT_SESSION_OK === true;
  }

  function tryAutoEnable(reason) {
    if (!sessionAllowsEdit()) {
      veLog('wait-session', reason || '');
      return false;
    }
    if (window.__glasticEnableVisualEdit) {
      enableEditMode();
      return true;
    }
    window.__GLASTIC_PENDING_VISUAL_ENABLE = true;
    veLog('pending-enable', reason || '');
    return false;
  }

  window.__GLASTIC_REQUEST_VISUAL_EDIT_ENABLE = tryAutoEnable;

  if (window.__GLASTIC_PENDING_VISUAL_ENABLE) {
    window.__GLASTIC_PENDING_VISUAL_ENABLE = false;
    tryAutoEnable('pending-flag');
  }

  if (isSameDocAdmin()) {
    veLog('boot', 'same-document admin edit');
    var autoTicks = 0;
    var autoTimer = setInterval(function () {
      autoTicks += 1;
      if (active && document.querySelectorAll('[data-editable]').length > 0) {
        clearInterval(autoTimer);
        return;
      }
      if (window.__GLASTIC_EDIT_SESSION_OK && !active) {
        tryAutoEnable('session-ok-retry-' + autoTicks);
      }
      if (autoTicks >= 40) {
        clearInterval(autoTimer);
        if (!active) veLog('auto-enable-gave-up', 'no active edit mode after 20s');
      }
    }, 500);
  }
})();
