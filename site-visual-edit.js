(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('visualEdit') !== '1') return;

  var active = false;
  var overlay = null;
  var highlight = null;
  var lastTarget = null;

  var STATIC_TARGETS = [
    { selector: '#site-banner', key: 'banner', label: 'Announcement banner' },
    { selector: '#site-logo', key: 'theme.logo', label: 'Logo' },
    { selector: '#hero-badge', key: 'homepage.heroBadge', label: 'Hero badge' },
    { selector: '#hero-headline', key: 'homepage.heroHeadline', label: 'Hero headline' },
    { selector: '#hero-subtext', key: 'homepage.heroSubtext', label: 'Hero intro text' },
    { selector: '#hero-image', key: 'homepage.heroImage', label: 'Hero photo' },
    { selector: '#hero-badge-note', key: 'homepage.heroBadgeNote', label: 'Photo badge note' },
    { selector: '#hero-badge-caption', key: 'homepage.heroBadgeCaption', label: 'Photo badge caption' },
    { selector: '#hero-facebook', key: 'homepage.heroFacebook', label: 'Hero button (Facebook)' },
    { selector: '#about-eyebrow', key: 'homepage.aboutEyebrow', label: 'About eyebrow' },
    { selector: '#about-title', key: 'homepage.aboutTitle', label: 'About title' },
    { selector: '#about-text', key: 'homepage.aboutText', label: 'About story' },
    { selector: '#about-image', key: 'homepage.aboutImage', label: 'About photo' },
    { selector: '#gallery-title', key: 'gallery.title', label: 'Gallery title' },
    { selector: '#gallery-subtitle', key: 'gallery.subtitle', label: 'Gallery subtitle' },
    { selector: '#impact-title', key: 'impact.title', label: 'Impact title' },
    { selector: '#contact-title', key: 'contact.contactTitle', label: 'Contact title' },
    { selector: '#contact-lead', key: 'contact.contactLead', label: 'Contact intro' },
    { selector: '[data-site-wa]', key: 'contact.whatsapp', label: 'WhatsApp button' },
    { selector: '[data-site-social="facebook"]', key: 'contact.facebook', label: 'Facebook link' },
    { selector: '[data-site-social="instagram"]', key: 'contact.instagram', label: 'Instagram link' },
    { selector: '[data-site-social="youtube"]', key: 'contact.youtube', label: 'YouTube link' },
    { selector: '[data-site-social="tiktok"]', key: 'contact.tiktok', label: 'TikTok link' }
  ];

  function inIframe() {
    try { return window.parent && window.parent !== window; } catch (e) { return false; }
  }

  function postToParent(msg) {
    if (!inIframe()) return;
    window.parent.postMessage(Object.assign({ source: 'glastic-visual-edit' }, msg), window.location.origin);
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'glastic-visual-edit-layer';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    highlight = document.createElement('div');
    highlight.className = 'glastic-ve-highlight';
    overlay.appendChild(highlight);
    var style = document.createElement('style');
    style.textContent = ''
      + '#glastic-visual-edit-layer{position:fixed;inset:0;z-index:9999;pointer-events:none;}'
      + '.glastic-ve-highlight{position:absolute;border:3px solid #14b8a6;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,118,110,.12);transition:top .08s,left .08s,width .08s,height .08s;pointer-events:none;}'
      + 'html.glastic-visual-edit-active [data-editable]{cursor:pointer;}'
      + 'html.glastic-visual-edit-active [data-editable]:focus{outline:2px dashed #14b8a6;outline-offset:3px;}';
    document.head.appendChild(style);
  }

  function routeOk(target) {
    if (!target.route || !target.route.length) return true;
    var route = window.GLASTIC_ROUTE || { id: 'home' };
    return target.route.indexOf(route.id) >= 0;
  }

  function markStatic() {
    STATIC_TARGETS.forEach(function (t) {
      if (!routeOk(t)) return;
      document.querySelectorAll(t.selector).forEach(function (el) {
        el.setAttribute('data-editable', t.key);
        el.setAttribute('data-editable-label', t.label);
      });
    });
  }

  function markDynamic() {
    var steps = document.querySelectorAll('#process-steps > div');
    for (var i = 0; i < steps.length; i++) {
      steps[i].setAttribute('data-editable', 'homepage.processSteps.' + i);
      steps[i].setAttribute('data-editable-label', 'Step ' + (i + 1));
    }
    document.querySelectorAll('#impact-bullets li').forEach(function (li, i) {
      li.setAttribute('data-editable', 'impact.bullets.' + i);
      li.setAttribute('data-editable-label', 'Impact bullet ' + (i + 1));
    });
    document.querySelectorAll('#impact-stats > div').forEach(function (node, i) {
      node.setAttribute('data-editable', 'impact.stats.' + i);
      node.setAttribute('data-editable-label', 'Stat ' + (i + 1));
    });
    document.querySelectorAll('#gallery-grid figure[data-gallery-id]').forEach(function (fig) {
      var id = fig.getAttribute('data-gallery-id');
      if (!id) return;
      fig.setAttribute('data-editable', 'gallery.item.' + id);
      fig.setAttribute('data-editable-label', 'Gallery photo');
    });
    document.querySelectorAll('.product-card').forEach(function (card) {
      var pid = card.getAttribute('data-product-id');
      if (pid) {
        card.setAttribute('data-editable', 'product.' + pid);
        card.setAttribute('data-editable-label', 'Product');
      }
    });
  }

  function refreshMarks() {
    if (!active) return;
    document.querySelectorAll('[data-editable]').forEach(function (el) {
      el.removeAttribute('data-editable');
      el.removeAttribute('data-editable-label');
    });
    markStatic();
    markDynamic();
  }

  window.__glasticVisualEditRefresh = refreshMarks;

  function rectFor(el) {
    var r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  function positionHighlight(el) {
    if (!highlight || !el) return;
    var r = rectFor(el);
    highlight.style.top = r.top + 'px';
    highlight.style.left = r.left + 'px';
    highlight.style.width = r.width + 'px';
    highlight.style.height = r.height + 'px';
    highlight.hidden = r.width < 2 || r.height < 2;
  }

  function findEditable(start) {
    var node = start;
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute('data-editable')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function onPointerMove(event) {
    if (!active) return;
    var el = findEditable(event.target);
    if (el !== lastTarget) {
      lastTarget = el;
      if (el) positionHighlight(el);
      else if (highlight) highlight.hidden = true;
    } else if (el) positionHighlight(el);
  }

  function onClick(event) {
    if (!active) return;
    var el = findEditable(event.target);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    postToParent({
      type: 'select',
      key: el.getAttribute('data-editable'),
      label: el.getAttribute('data-editable-label') || 'Edit'
    });
  }

  window.__glasticEnableVisualEdit = enableEditMode;
  window.__glasticDisableVisualEdit = disableEditMode;

  function enableEditMode() {
    if (active) return;
    active = true;
    window.GLASTIC_VISUAL_EDIT_ACTIVE = true;
    document.documentElement.classList.add('glastic-visual-edit-active');
    ensureOverlay();
    refreshMarks();
    document.addEventListener('mousemove', onPointerMove, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', function () {
      if (lastTarget) positionHighlight(lastTarget);
    }, true);
    window.addEventListener('resize', function () {
      if (lastTarget) positionHighlight(lastTarget);
    });
    postToParent({ type: 'ready' });
  }

  function disableEditMode() {
    active = false;
    window.GLASTIC_VISUAL_EDIT_ACTIVE = false;
    document.documentElement.classList.remove('glastic-visual-edit-active');
    document.removeEventListener('mousemove', onPointerMove, true);
    document.removeEventListener('click', onClick, true);
    if (highlight) highlight.hidden = true;
    lastTarget = null;
    document.querySelectorAll('[data-editable]').forEach(function (el) {
      el.removeAttribute('data-editable');
      el.removeAttribute('data-editable-label');
    });
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
