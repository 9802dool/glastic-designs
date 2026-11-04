(function () {
  var CACHE_KEY = 'glastic-site-settings-v1';

  function isSameDocumentAdminEdit() {
    try {
      return /(?:\?|&)adminEdit=1(?:&|$)/.test(window.location.search || '')
        && /(?:\?|&)visualEdit=1(?:&|$)/.test(window.location.search || '')
        && window.parent === window;
    } catch (e) {
      return false;
    }
  }

  function isVisualPreviewFrame() {
    try {
      if (isSameDocumentAdminEdit()) return true;
      return /(?:\?|&)visualEdit=1(?:&|$)/.test(window.location.search || '') && window.parent !== window;
    } catch (e) {
      return false;
    }
  }

  window.GLASTIC_ADMIN_SAME_DOC_EDIT = isSameDocumentAdminEdit;

  function isPreviewApply() {
    return Boolean(window.__GLASTIC_PREVIEW_APPLY);
  }

  var FONT_LINKS = {
    'playfair-inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap',
    'fraunces-inter': 'https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;600;700&display=swap',
    'lora-inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@600;700&display=swap',
    'dm-serif-inter': 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;600;700&display=swap'
  };

  var FONT_FAMILIES = {
    'playfair-inter': { display: "'Playfair Display', serif", body: "'Inter', sans-serif" },
    'fraunces-inter': { display: "'Fraunces', serif", body: "'Inter', sans-serif" },
    'lora-inter': { display: "'Lora', serif", body: "'Inter', sans-serif" },
    'dm-serif-inter': { display: "'DM Serif Display', serif", body: "'Inter', sans-serif" }
  };

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function setText(id, value, allowHtmlBreaks) {
    var node = document.getElementById(id);
    if (!node || value == null) return;
    if (allowHtmlBreaks) {
      node.innerHTML = esc(String(value)).replace(/\n/g, '<br>');
    } else {
      node.textContent = String(value);
    }
  }

  function setAttr(sel, attr, value) {
    document.querySelectorAll(sel).forEach(function (node) {
      if (value) node.setAttribute(attr, value);
      else node.removeAttribute(attr);
    });
  }

  function waLink(number) {
    var digits = String(number || '').replace(/\D/g, '');
    return digits ? 'https://wa.me/' + digits : '';
  }

  var DEFAULT_LOGO = '/logo.jpg';

  function resolveLogoUrl(url) {
    var text = String(url == null ? '' : url).trim();
    if (!text) return DEFAULT_LOGO;
    if (/^blob:/.test(text)) return text;
    if (/^https:\/\//.test(text) || /^\//.test(text)) return text;
    return DEFAULT_LOGO;
  }

  function wireSiteLogo() {
    var logo = document.getElementById('site-logo');
    var wordmark = document.getElementById('site-wordmark') || document.getElementById('site-logo-wordmark');
    if (!logo || logo.__glasticLogoWired) return;
    logo.__glasticLogoWired = true;
    logo.addEventListener('error', function () {
      logo.classList.add('is-broken');
      if (wordmark) wordmark.classList.add('is-fallback');
    });
    logo.addEventListener('load', function () {
      if (logo.naturalWidth > 0 && logo.naturalHeight > 0) {
        logo.classList.remove('is-broken');
        if (wordmark) wordmark.classList.remove('is-fallback');
      }
    });
  }

  function applySiteLogo(theme) {
    wireSiteLogo();
    var logo = document.getElementById('site-logo');
    if (!logo) return;
    var wordmark = document.getElementById('site-wordmark') || document.getElementById('site-logo-wordmark');
    var src = resolveLogoUrl(theme && theme.logoUrl);
    logo.classList.remove('is-broken');
    if (wordmark) wordmark.classList.remove('is-fallback');
    if (logo.getAttribute('src') !== src) logo.setAttribute('src', src);
  }

  function applyTheme(theme) {
    if (!theme) return;
    var root = document.documentElement;
    root.style.setProperty('--g-primary', theme.primary || '#065f46');
    root.style.setProperty('--g-primary-dark', theme.primaryDark || '#064e3b');
    root.style.setProperty('--g-accent', theme.accent || '#0f766e');
    root.style.setProperty('--g-bg', theme.background || '#fafaf9');
    root.style.setProperty('--g-text', theme.text || '#1c1917');
    var fonts = FONT_FAMILIES[theme.fontId] || FONT_FAMILIES['playfair-inter'];
    root.style.setProperty('--g-display-font', fonts.display);
    root.style.setProperty('--g-body-font', fonts.body);
    if (document.body) {
      document.body.style.backgroundColor = theme.background || '';
      document.body.style.color = theme.text || '';
    }
    var href = FONT_LINKS[theme.fontId] || FONT_LINKS['playfair-inter'];
    var link = document.getElementById('site-font-link');
    if (!link) {
      link = document.createElement('link');
      link.id = 'site-font-link';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    applySiteLogo(theme);
    if (isVisualPreviewFrame() || isPreviewApply()) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ theme: theme, at: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  function applyCachedTheme() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.theme) applyTheme(data.theme);
    } catch (e) { /* ignore */ }
  }

  function applyVisibility(visibility) {
    if (!visibility) return;
    var map = {
      hero: '#home',
      about: '#about',
      gallery: '#gallery',
      products: '#products',
      process: '#process',
      impact: '#impact',
      contact: '#contact',
      consultation: '[data-site-consultation]'
    };
    Object.keys(map).forEach(function (key) {
      var on = visibility[key] !== false;
      document.querySelectorAll(map[key]).forEach(function (node) {
        node.hidden = !on;
        node.style.display = on ? '' : 'none';
      });
    });
  }

  function renderGallery(galleryItems, meta) {
    var grid = document.getElementById('gallery-grid');
    if (!grid || !Array.isArray(galleryItems)) return;
    if (!galleryItems.length) {
      grid.innerHTML = '<p class="text-stone-500 col-span-full text-center">Gallery photos coming soon.</p>';
      return;
    }
    grid.innerHTML = galleryItems.map(function (item) {
      return '<figure class="group" data-gallery-id="' + esc(item.id || '') + '">'
        + '<div class="photo-frame h-72 sm:h-80 rounded-3xl overflow-hidden bg-stone-200">'
        + '<img src="' + esc(item.url) + '" alt="' + esc(item.caption || 'Gallery photo') + '" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy">'
        + '</div>'
        + '<figcaption class="mt-3 text-sm font-medium text-stone-700">' + esc(item.caption || '') + '</figcaption>'
        + '</figure>';
    }).join('');
    if (window.__glasticVisualEditRefresh) window.__glasticVisualEditRefresh();
    if (meta) {
      setText('gallery-title', meta.title);
      setText('gallery-subtitle', meta.subtitle);
    }
  }

  function renderProcess(steps) {
    var grid = document.getElementById('process-steps');
    if (!grid || !Array.isArray(steps)) return;
    grid.innerHTML = steps.map(function (step, index) {
      return '<div class="text-center">'
        + '<div class="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">' + (index + 1) + '</div>'
        + '<h3 class="font-bold text-xl mb-3">' + esc(step.title || '') + '</h3>'
        + '<p class="text-emerald-100">' + esc(step.text || '') + '</p>'
        + '</div>';
    }).join('');
    if (window.__glasticVisualEditRefresh) window.__glasticVisualEditRefresh();
  }

  function renderImpact(impact) {
    if (!impact) return;
    setText('impact-title', impact.title);
    var list = document.getElementById('impact-bullets');
    if (list && Array.isArray(impact.bullets)) {
      list.innerHTML = impact.bullets.map(function (line) {
        return '<li class="flex items-start gap-3"><i class="fas fa-check-circle text-emerald-600 mt-1"></i> <span>' + esc(line) + '</span></li>';
      }).join('');
    }
    var stats = document.getElementById('impact-stats');
    if (stats && Array.isArray(impact.stats)) {
      stats.innerHTML = impact.stats.map(function (stat) {
        return '<div class="bg-white p-6 rounded-2xl text-center shadow-sm">'
          + '<div class="text-4xl font-bold text-emerald-600">' + esc(stat.value) + '</div>'
          + '<div class="text-sm text-stone-600">' + esc(stat.label) + '</div>'
          + '</div>';
      }).join('');
    }
    if (window.__glasticVisualEditRefresh) window.__glasticVisualEditRefresh();
  }

  function applyBanner(banner) {
    var bar = document.getElementById('site-banner');
    if (!bar) return;
    if (!banner || !banner.enabled || !banner.text) {
      bar.hidden = true;
      bar.innerHTML = '';
      if (document.body) document.body.classList.remove('has-site-banner');
      return;
    }
    bar.hidden = false;
    if (document.body) document.body.classList.add('has-site-banner');
    var inner = esc(banner.text);
    if (banner.link) {
      inner = '<a href="' + esc(banner.link) + '" class="underline font-semibold">' + inner + '</a>';
    }
    bar.innerHTML = inner;
  }

  function applyContact(contact) {
    if (!contact) return;
    setText('contact-title', contact.contactTitle);
    setText('contact-lead', contact.contactLead);
    var wa = waLink(contact.whatsapp);
    document.querySelectorAll('[data-site-wa]').forEach(function (node) {
      if (wa) {
        node.setAttribute('href', wa);
        node.hidden = false;
      } else {
        node.hidden = true;
      }
    });
    var waLabel = document.getElementById('contact-wa-label');
    if (waLabel && contact.whatsapp) {
      var display = String(contact.whatsapp).replace(/^1/, '').slice(-7);
      waLabel.textContent = display ? 'WhatsApp ' + display : 'WhatsApp';
    }
    var socials = [
      ['facebook', contact.facebook],
      ['instagram', contact.instagram],
      ['youtube', contact.youtube],
      ['tiktok', contact.tiktok]
    ];
    socials.forEach(function (pair) {
      document.querySelectorAll('[data-site-social="' + pair[0] + '"]').forEach(function (node) {
        if (pair[1]) {
          node.setAttribute('href', pair[1]);
          node.hidden = false;
        } else {
          node.hidden = true;
        }
      });
    });
    var emailRow = document.getElementById('contact-email-row');
    if (emailRow) {
      if (contact.email) {
        emailRow.hidden = false;
        setText('contact-email', contact.email);
        var mailLink = document.getElementById('contact-email-link');
        if (mailLink) mailLink.setAttribute('href', 'mailto:' + contact.email);
      } else {
        emailRow.hidden = true;
      }
    }
    var hoursRow = document.getElementById('contact-hours-row');
    if (hoursRow) {
      if (contact.hours) {
        hoursRow.hidden = false;
        setText('contact-hours', contact.hours);
      } else {
        hoursRow.hidden = true;
      }
    }
    var payWa = document.getElementById('pay-whatsapp');
    if (payWa && wa) payWa.setAttribute('href', wa);
  }

  function applyShopSection(shop) {
    if (!shop) return;
    var route = window.GLASTIC_ROUTE || { id: 'home' };
    var title = document.getElementById('products-title');
    var lead = document.getElementById('products-lead');
    if (title && lead) {
      if (route.id === 'category' && route.category) {
        title.textContent = (shop.categoryTitles && shop.categoryTitles[route.category]) || route.category;
        lead.textContent = (shop.categoryBlurbs && shop.categoryBlurbs[route.category]) || '';
      } else if (route.id === 'category') {
        title.textContent = shop.invalidCategoryTitle || 'Shop';
        lead.textContent = shop.invalidCategoryLead || '';
      } else if (route.id === 'products') {
        title.textContent = shop.title || title.textContent;
        lead.textContent = shop.lead || lead.textContent;
      }
    }
    setText('products-demo-note', shop.demoNote);
  }

  function applyAboutPageExtras(aboutPage) {
    if (!aboutPage) return;
    (aboutPage.features || []).forEach(function (feat, i) {
      setText('about-feature-' + i + '-title', feat.title);
      setText('about-feature-' + i + '-text', feat.text);
    });
    var plant = document.getElementById('about-plant-image');
    if (plant && aboutPage.plantImage) plant.setAttribute('src', aboutPage.plantImage);
    setText('about-plant-caption', aboutPage.plantCaption);
  }

  function applyProcessPage(processPage) {
    if (!processPage) return;
    setText('process-page-title', processPage.title);
  }

  function applyConsultationBlock(c) {
    if (!c) return;
    setText('consult-eyebrow', c.eyebrow);
    setText('consult-title', c.title);
    setText('consult-lead', c.lead);
    setText('consult-deposit-amount', c.depositAmount);
    setText('consult-deposit-label', c.depositLabel);
    setText('consult-pay-button', c.payButton);
    setText('consult-wa-button', c.waButton);
    setText('consult-note', c.note);
  }

  function applyCartPage(cartPage) {
    if (!cartPage) return;
    setText('cart-page-title', cartPage.title);
    setText('cart-page-intro', cartPage.intro);
    setText('cart-empty-text', cartPage.emptyText);
    setText('cart-subtotal-label', cartPage.subtotalLabel);
    setText('cart-checkout-button', cartPage.checkoutButton);
    setText('cart-checkout-note', cartPage.checkoutNote);
    setText('cart-continue-label', cartPage.continueLabel);
  }

  function applyFooter(footer) {
    if (!footer) return;
    setText('footer-brand', footer.brand);
    setText('footer-tagline', footer.tagline);
    setText('footer-subline', footer.subline);
    setText('footer-copyright', footer.copyright);
  }

  function applyNavLabels(nav) {
    if (!nav) return;
    document.querySelectorAll('[data-nav-label]').forEach(function (node) {
      var key = node.getAttribute('data-nav-label');
      if (key && nav[key] != null) node.textContent = nav[key];
    });
    var menuBtn = document.getElementById('menu-open');
    if (menuBtn && nav.menuOpen && menuBtn.getAttribute('aria-expanded') !== 'true') {
      menuBtn.textContent = nav.menuOpen;
    }
  }

  function applyChrome(chrome) {
    if (!chrome) return;
    setText('site-wordmark', chrome.wordmark);
    setText('hero-explore-label', chrome.heroExploreLabel);
    var explore = document.getElementById('hero-explore-cta');
    if (explore && chrome.heroExploreHref) explore.setAttribute('href', chrome.heroExploreHref);
    setText('hero-facebook-label', chrome.heroFacebookLabel);
    setText('contact-facebook-label', chrome.contactFacebookLabel);
    setText('contact-email-label', chrome.contactEmailLabel || 'Email:');
    setText('contact-hours-label', chrome.contactHoursLabel || 'Hours:');
  }

  function applyAll(payload) {
    if (!payload || !payload.settings) return;
    var s = payload.settings;
    window.__GLASTIC_LAST_SETTINGS = s;
    applyTheme(s.theme);
    applyBanner(s.banner);
    applyVisibility(s.visibility);
    var hp = s.homepage || {};
    setText('hero-badge', hp.heroBadge);
    setText('hero-headline', hp.heroHeadline, true);
    setText('hero-subtext', hp.heroSubtext);
    setText('hero-badge-note', hp.heroBadgeNote);
    setText('hero-badge-caption', hp.heroBadgeCaption);
    var heroImg = document.getElementById('hero-image');
    if (heroImg && hp.heroImage) heroImg.setAttribute('src', hp.heroImage);
    setText('about-eyebrow', hp.aboutEyebrow);
    setText('about-title', hp.aboutTitle);
    setText('about-text', hp.aboutText);
    var aboutImg = document.getElementById('about-image');
    if (aboutImg && hp.aboutImage) aboutImg.setAttribute('src', hp.aboutImage);
    renderProcess(hp.processSteps);
    renderImpact(s.impact);
    renderGallery(payload.gallery, s.gallery);
    applyContact(s.contact);
    var fbHero = document.getElementById('hero-facebook');
    if (fbHero && s.contact && s.contact.facebook) fbHero.setAttribute('href', s.contact.facebook);
    applyShopSection(s.shop);
    applyAboutPageExtras(s.aboutPage);
    applyProcessPage(s.processPage);
    applyConsultationBlock(s.consultation);
    applyCartPage(s.cartPage);
    applyFooter(s.footer);
    applyNavLabels(s.nav);
    applyChrome(s.chrome);
    if (window.__glasticVisualEditRefresh) window.__glasticVisualEditRefresh();
  }

  window.__glasticApplyShopTitles = function () {
    var s = window.__GLASTIC_LAST_SETTINGS;
    if (s && s.shop) applyShopSection(s.shop);
  };

  var DEFAULT_PAYLOAD = {
    settings: {
      theme: { preset: 'forest', primary: '#065f46', primaryDark: '#064e3b', accent: '#0f766e', background: '#fafaf9', text: '#1c1917', fontId: 'playfair-inter', logoUrl: '/logo.jpg' },
      banner: { enabled: false, text: '', link: '' },
      visibility: { hero: true, about: true, gallery: true, products: true, process: true, impact: true, contact: true, consultation: true },
      homepage: {
        heroBadge: 'Made in Trinidad & Tobago ♻️',
        heroHeadline: 'Plastic Waste.\nBeautiful Design.',
        heroSubtext: 'We transform discarded plastic into durable, stylish interior products — tiles, furniture, coasters and more. Creating a circular economy right here in Trinidad and Tobago.',
        heroImage: '/images/living-wall.jpg',
        heroBadgeNote: 'T&T',
        heroBadgeCaption: 'Living walls & planters',
        aboutEyebrow: "We are nature's Keepers",
        aboutTitle: 'From Waste to Wonder',
        aboutText: 'Founded by Alicia Barrie-George, Glastic Designs (a play on glass, plants and plastics) began with a vision to introduce green spaces into urban Trinidad. After recognizing the massive volume of plastic waste, we pivoted to upcycling — turning discarded materials into high-value interior products, including living walls and planters.',
        aboutImage: '/images/owner.jpg',
        processSteps: [
          { title: 'Collect', text: 'We collect plastic waste at events, from partners and communities across Trinidad and Tobago.' },
          { title: 'Sort & Shred', text: 'Plastics are sorted by type and color, then shredded for consistent material quality.' },
          { title: 'Process', text: 'Using Precious Plastic techniques, we melt and form the plastic into sheets, tiles and components.' },
          { title: 'Create', text: 'Crafted into durable, beautiful products ready for homes, schools and businesses.' }
        ]
      },
      gallery: { title: "Nature's Keepers", subtitle: 'Living walls and planters from our work in Trinidad and Tobago.' },
      impact: {
        title: 'Making a Difference',
        bullets: [
          'Collected tens of kilograms at events (e.g. 33 lbs at Honeyfest, 60kg with partners)',
          'Partnered with NGC and others supporting local recycling efforts',
          'Changing the cultural perspective: plastic is a resource, not trash',
          'Supporting Every Bottle Back TT and circular economy initiatives'
        ],
        stats: [
          { value: '100%', label: 'Plastic Waste Products' },
          { value: '$250', label: 'TT Benches' },
          { value: '0.25kg', label: 'Recycled per Tile' },
          { value: 'T&T', label: 'Proudly Local' }
        ]
      },
      contact: {
        whatsapp: '18687752407',
        facebook: 'https://www.facebook.com/gdistyles',
        instagram: 'https://instagram.com/glasticdesigns',
        tiktok: 'https://www.tiktok.com/@glastic.designs',
        youtube: 'https://www.youtube.com/@GlasticDesigns',
        email: '',
        hours: '',
        contactTitle: 'Ready to Order or Partner?',
        contactLead: 'DM us on Facebook, WhatsApp, or follow our journey. Custom colors, sizes and bulk orders welcome.'
      }
    },
    gallery: [
      { id: 'living-wall', url: '/images/living-wall.jpg', caption: 'Outdoor living wall' },
      { id: 'fern-planter', url: '/images/fern-planter.jpg', caption: 'Indoor vertical planter' },
      { id: 'front-door-garden', url: '/images/front-door-garden.jpg', caption: 'Front-door garden' },
      { id: 'triangle-planter', url: '/images/triangle-planter.jpg', caption: 'Triangle wall planter' },
      { id: 'planter-frames', url: '/images/planter-frames.jpg', caption: 'Planter frames in the workshop' }
    ]
  };

  window.GLASTIC_APPLY_SETTINGS = applyAll;

  function applyPreviewMessage(data) {
    window.__GLASTIC_PREVIEW_APPLY = true;
    try {
      if (data.settingsPayload) applyAll(data.settingsPayload);
      if (data.products && window.GLASTIC_RENDER_CATALOG) window.GLASTIC_RENDER_CATALOG(data.products);
    } finally {
      window.__GLASTIC_PREVIEW_APPLY = false;
    }
    if (window.__glasticVisualEditRefresh) window.__glasticVisualEditRefresh();
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== 'glastic-visual-admin') return;
    if (data.type === 'preview') applyPreviewMessage(data);
    if (data.type === 'enable') {
      if (window.__glasticEnableVisualEdit) window.__glasticEnableVisualEdit();
      else window.__GLASTIC_PENDING_VISUAL_ENABLE = true;
    }
    if (data.type === 'disable' && window.__glasticDisableVisualEdit) {
      window.__glasticDisableVisualEdit();
    }
  });

  if (isVisualPreviewFrame()) {
    /* Admin editor pushes draft settings; do not fetch published settings over the preview. */
    if (isSameDocumentAdminEdit()) {
      applyCachedTheme();
    }
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ source: 'glastic-visual-edit', type: 'iframe-loaded' }, window.location.origin);
      } catch (e) { /* ignore */ }
    }
  } else {
    function bootPublicSite() {
      applyCachedTheme();
      applyAll(DEFAULT_PAYLOAD);
      fetch('/api/settings', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (isVisualPreviewFrame()) return;
          applyAll(data);
        })
        .catch(function () { /* defaults in HTML remain */ });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootPublicSite);
    } else {
      bootPublicSite();
    }
  }
})();
