(function () {
  var DEFAULTS = {
    home: {
      heroBadge: 'Made in Trinidad & Tobago ♻️',
      heroHeadline: 'Plastic Waste.\nBeautiful Design.',
      heroSubtext: 'We transform discarded plastic into durable, stylish interior products — tiles, furniture, coasters and more. Creating a circular economy right here in Trinidad and Tobago.',
      heroImage: '/images/living-wall.jpg',
      heroBadgeNote: 'T&T',
      heroBadgeCaption: 'Living walls & planters',
      exploreLabel: 'Explore Products'
    },
    about: {
      eyebrow: "We are nature's Keepers",
      title: 'From Waste to Wonder',
      text: 'Founded by Alicia Barrie-George, Glastic Designs (a play on glass, plants and plastics) began with a vision to introduce green spaces into urban Trinidad. After recognizing the massive volume of plastic waste, we pivoted to upcycling — turning discarded materials into high-value interior products, including living walls and planters.',
      image: '/images/owner.jpg',
      feature0Title: 'Circular Economy',
      feature0Text: 'Every product gives plastic a second life, reducing landfill waste and pollution in our communities and oceans.',
      feature1Title: 'School Furniture',
      feature1Text: 'We refurbish discarded school furniture using recycled plastic, providing low-cost solutions and better learning environments.',
      feature2Title: 'Made in TNT',
      feature2Text: 'Proudly designed and manufactured in Trinidad and Tobago. Supporting local jobs and Caribbean entrepreneurship.',
      plantImage: '/images/plant-benefits.jpg',
      plantCaption: 'Plantastic benefits of indoor plants, from our Facebook page.'
    },
    gallery: {
      title: "Nature's Keepers",
      subtitle: 'Living walls and planters from our work in Trinidad and Tobago.'
    },
    shop: {
      title: 'Our Products',
      lead: 'Durable, waterproof, low-maintenance pieces crafted from 100% plastic waste. Custom colors and sizes available.',
      demoNote: 'Add pieces to your cart, then check out once. The payment step is a demo — nothing is charged.',
      categoryTitles: {
        Tiles: 'Tiles',
        Planters: 'Planters',
        Furniture: 'Furniture',
        Gifts: 'Gifts',
        Services: 'Services'
      },
      categoryBlurbs: {
        Tiles: 'Durable, waterproof wall and floor tiles made from plastic waste. Hexagonal, square, and rectangular shapes are available.',
        Planters: "Living walls and vertical planters. We are nature's Keepers, planting walls for homes and outdoors in Trinidad and Tobago.",
        Furniture: 'Benches, stools, shelves, consoles, and tables for indoors, outdoors, classrooms, and patios.',
        Gifts: 'Coasters, clocks, trophies, medals, and keychains made from upcycled plastic.',
        Services: 'Refurbished school desks and chairs, and design consultations with the studio.'
      }
    },
    process: {
      title: 'How We Make It',
      step0Title: 'Collect',
      step0Text: 'We collect plastic waste at events, from partners and communities across Trinidad and Tobago.',
      step1Title: 'Sort & Shred',
      step1Text: 'Plastics are sorted by type and color, then shredded for consistent material quality.',
      step2Title: 'Process',
      step2Text: 'Using Precious Plastic techniques, we melt and form the plastic into sheets, tiles and components.',
      step3Title: 'Create',
      step3Text: 'Crafted into durable, beautiful products ready for homes, schools and businesses.'
    },
    impact: {
      title: 'Making a Difference',
      bullet0: 'Collected tens of kilograms at events (e.g. 33 lbs at Honeyfest, 60kg with partners)',
      bullet1: 'Partnered with NGC and others supporting local recycling efforts',
      bullet2: 'Changing the cultural perspective: plastic is a resource, not trash',
      bullet3: 'Supporting Every Bottle Back TT and circular economy initiatives',
      stat0Value: '100%',
      stat0Label: 'Plastic Waste Products',
      stat1Value: '$250',
      stat1Label: 'TT Benches',
      stat2Value: '0.25kg',
      stat2Label: 'Recycled per Tile',
      stat3Value: 'T&T',
      stat3Label: 'Proudly Local'
    },
    contact: {
      title: 'Ready to Order or Partner?',
      lead: 'DM us on Facebook, WhatsApp, or follow our journey. Custom colors, sizes and bulk orders welcome.',
      consultEyebrow: 'Book a consultation',
      consultTitle: 'Port of Spain studio visit',
      consultLead: 'Reserve a design consultation and preview how paying online would work. The amount is a sample deposit in TTD.',
      consultDeposit: '$150.00 TTD',
      consultDepositLabel: 'Deposit',
      consultPayButton: 'Pay Deposit',
      consultWaButton: 'WhatsApp instead',
      consultNote: 'Demo — no real payment will be taken.',
      whatsappLabel: 'WhatsApp 775-2407',
      facebookLabel: 'Facebook Page'
    },
    cart: {
      title: 'Your cart',
      intro: 'Review the pieces you chose, then use one demo checkout. Nothing is charged.',
      emptyText: 'Your cart is empty. Add a piece from the shop, then come back here to check out.',
      subtotalLabel: 'Subtotal',
      checkoutButton: 'Checkout',
      checkoutNote: 'One demo checkout for this order. No real payment will be taken.',
      continueLabel: 'Continue shopping'
    },
    footer: {
      brand: 'Glastic Designs Interior Styles',
      tagline: 'Transforming plastic waste into beautiful, durable designs.',
      subline: 'Proudly Made in Trinidad & Tobago 🇹🇹 | Circular Economy | Support Local',
      copyright: '© 2026 Glastic Designs. All rights reserved. Content inspired by the official Facebook page.'
    }
  };

  var SEED_GALLERY = [
    { url: '/images/living-wall.jpg', caption: 'Outdoor living wall' },
    { url: '/images/fern-planter.jpg', caption: 'Indoor vertical planter' },
    { url: '/images/front-door-garden.jpg', caption: 'Front-door garden' },
    { url: '/images/triangle-planter.jpg', caption: 'Triangle wall planter' },
    { url: '/images/planter-frames.jpg', caption: 'Planter frames in the workshop' }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function setText(nodes, text) {
    if (text == null || !nodes) return;
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
  }

  function setMultiline(el, text) {
    if (!el || text == null) return;
    var parts = String(text).split('\n');
    el.textContent = '';
    for (var i = 0; i < parts.length; i++) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(parts[i]));
    }
  }

  function setImg(container, url, alt) {
    if (!container || !url) return;
    var img = container.querySelector('img');
    if (!img) return;
    img.src = url;
    if (alt) img.alt = alt;
    var webp = url.replace(/\.(jpe?g|png)$/i, '.webp');
    if (webp !== url && /^\/images\//.test(url)) {
      var source = container.querySelector('source');
      if (source) source.srcset = webp;
    } else {
      var sourceRemote = container.querySelector('source');
      if (sourceRemote && /^https:\/\//.test(url)) sourceRemote.remove();
    }
  }

  function pageSaved(meta, pageId) {
    return meta && meta.savedPages && meta.savedPages[pageId];
  }

  function mergePage(pageId, saved, meta) {
    if (!pageSaved(meta, pageId)) return null;
    return Object.assign({}, DEFAULTS[pageId], (saved && saved[pageId]) || {});
  }

  function applyHome(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="home.heroBadge"]'), data.heroBadge);
    var head = document.querySelector('[data-content="home.heroHeadline"]');
    setMultiline(head, data.heroHeadline);
    setText(document.querySelectorAll('[data-content="home.heroSubtext"]'), data.heroSubtext);
    setText(document.querySelectorAll('[data-content="home.exploreLabel"]'), data.exploreLabel);
    setText(document.querySelectorAll('[data-content="home.heroBadgeNote"]'), data.heroBadgeNote);
    setText(document.querySelectorAll('[data-content="home.heroBadgeCaption"]'), data.heroBadgeCaption);
    setImg(document.querySelector('[data-content-image="home.heroImage"]'), data.heroImage);
  }

  function applyAbout(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="about.eyebrow"]'), data.eyebrow);
    setText(document.querySelectorAll('[data-content="about.title"]'), data.title);
    setText(document.querySelectorAll('[data-content="about.text"]'), data.text);
    setImg(document.querySelector('[data-content-image="about.image"]'), data.image);
    setText(document.querySelectorAll('[data-content="about.feature0Title"]'), data.feature0Title);
    setText(document.querySelectorAll('[data-content="about.feature0Text"]'), data.feature0Text);
    setText(document.querySelectorAll('[data-content="about.feature1Title"]'), data.feature1Title);
    setText(document.querySelectorAll('[data-content="about.feature1Text"]'), data.feature1Text);
    setText(document.querySelectorAll('[data-content="about.feature2Title"]'), data.feature2Title);
    setText(document.querySelectorAll('[data-content="about.feature2Text"]'), data.feature2Text);
    setImg(document.querySelector('[data-content-image="about.plantImage"]'), data.plantImage);
    setText(document.querySelectorAll('[data-content="about.plantCaption"]'), data.plantCaption);
  }

  function applyGalleryText(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="gallery.title"]'), data.title);
    setText(document.querySelectorAll('[data-content="gallery.subtitle"]'), data.subtitle);
  }

  function applyShop(data) {
    if (!data) return;
    window.GLASTIC_SHOP_COPY = {
      title: data.title,
      lead: data.lead,
      categoryTitles: data.categoryTitles || {},
      categoryBlurbs: data.categoryBlurbs || {}
    };
    var title = document.getElementById('products-title');
    var lead = document.getElementById('products-lead');
    var route = window.GLASTIC_ROUTE || {};
    if (title && route.id !== 'category') title.textContent = data.title;
    if (lead && route.id !== 'category') lead.textContent = data.lead;
    setText(document.querySelectorAll('[data-content="shop.demoNote"]'), data.demoNote);
    if (window.GlasticNav && window.GlasticNav.refreshShopHeadings) {
      window.GlasticNav.refreshShopHeadings();
    }
  }

  function applyProcess(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="process.title"]'), data.title);
    for (var i = 0; i < 4; i++) {
      setText(document.querySelectorAll('[data-content="process.step' + i + 'Title"]'), data['step' + i + 'Title']);
      setText(document.querySelectorAll('[data-content="process.step' + i + 'Text"]'), data['step' + i + 'Text']);
    }
  }

  function applyImpact(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="impact.title"]'), data.title);
    for (var b = 0; b < 4; b++) {
      setText(document.querySelectorAll('[data-content="impact.bullet' + b + '"]'), data['bullet' + b]);
    }
    for (var s = 0; s < 4; s++) {
      setText(document.querySelectorAll('[data-content="impact.stat' + s + 'Value"]'), data['stat' + s + 'Value']);
      setText(document.querySelectorAll('[data-content="impact.stat' + s + 'Label"]'), data['stat' + s + 'Label']);
    }
  }

  function applyContact(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="contact.title"]'), data.title);
    setText(document.querySelectorAll('[data-content="contact.lead"]'), data.lead);
    setText(document.querySelectorAll('[data-content="contact.consultEyebrow"]'), data.consultEyebrow);
    setText(document.querySelectorAll('[data-content="contact.consultTitle"]'), data.consultTitle);
    setText(document.querySelectorAll('[data-content="contact.consultLead"]'), data.consultLead);
    setText(document.querySelectorAll('[data-content="contact.consultDeposit"]'), data.consultDeposit);
    setText(document.querySelectorAll('[data-content="contact.consultDepositLabel"]'), data.consultDepositLabel);
    setText(document.querySelectorAll('[data-content="contact.consultPayButton"]'), data.consultPayButton);
    setText(document.querySelectorAll('[data-content="contact.consultWaButton"]'), data.consultWaButton);
    setText(document.querySelectorAll('[data-content="contact.consultNote"]'), data.consultNote);
    setText(document.querySelectorAll('[data-content="contact.whatsappLabel"]'), data.whatsappLabel);
    setText(document.querySelectorAll('[data-content="contact.facebookLabel"]'), data.facebookLabel);
  }

  function applyCart(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="cart.title"]'), data.title);
    setText(document.querySelectorAll('[data-content="cart.intro"]'), data.intro);
    setText(document.querySelectorAll('[data-content="cart.emptyText"]'), data.emptyText);
    setText(document.querySelectorAll('[data-content="cart.subtotalLabel"]'), data.subtotalLabel);
    setText(document.querySelectorAll('[data-content="cart.checkoutButton"]'), data.checkoutButton);
    setText(document.querySelectorAll('[data-content="cart.checkoutNote"]'), data.checkoutNote);
    setText(document.querySelectorAll('[data-content="cart.continueLabel"]'), data.continueLabel);
  }

  function applyFooter(data) {
    if (!data) return;
    setText(document.querySelectorAll('[data-content="footer.brand"]'), data.brand);
    setText(document.querySelectorAll('[data-content="footer.tagline"]'), data.tagline);
    setText(document.querySelectorAll('[data-content="footer.subline"]'), data.subline);
    setText(document.querySelectorAll('[data-content="footer.copyright"]'), data.copyright);
  }

  function renderGalleryPhotos(items) {
    var grid = document.getElementById('gallery-grid');
    if (!grid || !items || !items.length) return;
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var url = item.url || '';
      var caption = item.caption || '';
      html += '<figure class="group"><div class="photo-frame h-72 sm:h-80 rounded-3xl overflow-hidden bg-stone-200">'
        + '<img src="' + esc(url) + '" alt="' + esc(caption) + '" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy">'
        + '</div><figcaption class="mt-3 text-sm font-medium text-stone-700">' + esc(caption) + '</figcaption></figure>';
    }
    grid.innerHTML = html;
  }

  function boot() {
    try {
      fetch('/api/settings', { credentials: 'same-origin' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (payload) {
          if (!payload) return;
          var saved = payload.pages_v2 || {};
          var meta = payload.pages_v2_meta || {};
          applyHome(mergePage('home', saved, meta));
          applyAbout(mergePage('about', saved, meta));
          applyGalleryText(mergePage('gallery', saved, meta));
          applyShop(mergePage('shop', saved, meta));
          applyProcess(mergePage('process', saved, meta));
          applyImpact(mergePage('impact', saved, meta));
          applyContact(mergePage('contact', saved, meta));
          applyCart(mergePage('cart', saved, meta));
          applyFooter(mergePage('footer', saved, meta));
          if (meta.galleryLive && payload.gallery && payload.gallery.length) {
            renderGalleryPhotos(payload.gallery);
          }
        })
        .catch(function () { /* keep hardcoded HTML */ });
    } catch (error) { /* keep hardcoded HTML */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
