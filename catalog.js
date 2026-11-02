(function () {
  var FALLBACK = [
    { id: 'tiles', name: 'Plastic Tiles', description: 'Durable, waterproof wall and floor tiles made from plastic waste. Hexagonal, square, and rectangular shapes are available.', category: 'Tiles', priceTtd: 25, photos: [{ url: '/images/triangle-planter.jpg', isMain: true }] },
    { id: 'benches', name: 'Bench or Stool', description: 'Compact, sturdy seating for indoors, outdoors, classrooms, and patios.', category: 'Furniture', priceTtd: 250, photos: [{ url: '/images/front-door-garden.jpg', isMain: true }] },
    { id: 'shelves', name: 'Shelf or Furniture', description: 'Shelving, consoles, and tables with custom heights and colors. Suitable indoors and outdoors.', category: 'Furniture', priceTtd: 300, photos: [{ url: '/images/fern-planter.jpg', isMain: true }] },
    { id: 'coasters', name: 'Coasters & Clock', description: 'Coasters and clocks made from upcycled plastic. Sample gift set.', category: 'Gifts', priceTtd: 80, photos: [{ url: '/images/planter-frames.jpg', isMain: true }] },
    { id: 'awards', name: 'Custom Award', description: 'Custom trophies, medals, and keychains for events and gifts.', category: 'Gifts', priceTtd: 200, photos: [{ url: '/images/triangle-planter.jpg', isMain: true }] },
    { id: 'school', name: 'School Furniture Refurb', description: 'Refurbished school desks and chairs using recycled plastic.', category: 'Services', priceTtd: 150, photos: [{ url: '/images/living-wall.jpg', isMain: true }] }
  ];

  function money(value) {
    return '$' + Number(value).toFixed(2) + ' TTD';
  }

  function mainPhoto(product) {
    var photos = product.photos || [];
    for (var i = 0; i < photos.length; i++) if (photos[i].isMain) return photos[i];
    return photos[0] || null;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function photoHtml(url, alt, className) {
    return '<img src="' + esc(url) + '" alt="' + esc(alt) + '" class="' + className + '" loading="lazy">';
  }

  function render(products) {
    var grid = document.getElementById('product-grid');
    if (!grid) return;
    document.querySelectorAll('.product-page').forEach(function (page) { page.remove(); });
    grid.textContent = '';
    if (!products.length) {
      grid.innerHTML = '<p class="text-stone-600 col-span-full text-center">No products to show right now.</p>';
    }
    products.forEach(function (product) {
      var photo = mainPhoto(product);
      var card = document.createElement('div');
      card.className = 'product-card group bg-stone-50 rounded-3xl overflow-hidden cursor-pointer';
      card.innerHTML = ''
        + '<div class="photo-frame h-64 bg-stone-200 relative overflow-hidden">'
        + (photo ? photoHtml(photo.url, product.name + ' by Glastic Designs', 'w-full h-full object-cover') : '')
        + '</div>'
        + '<div class="p-6">'
        + '<h3 class="font-bold text-2xl mb-2"></h3>'
        + '<p class="text-stone-600 mb-4"></p>'
        + '<div class="flex justify-between items-center"><span class="text-emerald-700 font-semibold"></span><span class="text-sm text-stone-500"></span></div>'
        + '<div class="cart-row" data-cart-control>'
        + '<div class="qty-stepper">'
        + '<button type="button" class="qty-btn" data-qty-delta="-1" aria-label="Decrease quantity">−</button>'
        + '<input class="qty-input" type="number" min="1" max="99" value="1" inputmode="numeric">'
        + '<button type="button" class="qty-btn" data-qty-delta="1" aria-label="Increase quantity">+</button>'
        + '</div>'
        + '<button type="button" class="pay-btn cart-add-btn bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full px-3" data-cart-add="">Add to Cart</button>'
        + '</div>'
        + '</div>';
      card.querySelector('h3').textContent = product.name;
      card.querySelector('.text-stone-600').textContent = product.description;
      card.querySelector('.text-emerald-700').textContent = money(product.priceTtd);
      card.querySelector('.text-stone-500').textContent = product.category;
      card.querySelector('[data-cart-add]').setAttribute('data-cart-add', product.id);
      card.querySelector('.qty-input').setAttribute('aria-label', 'Quantity for ' + product.name);
      card.addEventListener('click', function (event) {
        if (event.target.closest('[data-cart-control]')) return;
        var page = document.getElementById('page-' + product.id);
        if (page) page.classList.remove('hidden');
      });
      grid.appendChild(card);

      var page = document.createElement('div');
      page.id = 'page-' + product.id;
      page.className = 'product-page hidden fixed inset-0 z-50 bg-stone-50 overflow-y-auto';
      page.innerHTML = '<div class="max-w-5xl mx-auto px-4 py-8">'
        + '<button type="button" class="back mb-6 text-emerald-700 font-medium flex items-center gap-2"><i class="fas fa-arrow-left"></i> Back to Products</button>'
        + '<div class="product-detail grid lg:grid-cols-2 gap-10">'
        + '<div class="product-gallery"></div>'
        + '<div><h1 class="font-display text-4xl font-bold text-emerald-900 mb-2"></h1>'
        + '<p class="text-emerald-800 font-semibold mb-4"></p>'
        + '<div class="flex flex-col gap-3 mb-6" data-cart-control>'
        + '<div class="qty-stepper qty-stepper-lg">'
        + '<button type="button" class="qty-btn" data-qty-delta="-1" aria-label="Decrease quantity">−</button>'
        + '<input class="qty-input" type="number" min="1" max="99" value="1" inputmode="numeric">'
        + '<button type="button" class="qty-btn" data-qty-delta="1" aria-label="Increase quantity">+</button>'
        + '</div>'
        + '<button type="button" class="pay-btn inline-flex w-full items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-semibold text-lg" data-cart-add="">Add to Cart</button>'
        + '<p class="text-xs text-stone-500">Add this to your cart, then use Checkout once. Demo payment — nothing is charged.</p>'
        + '</div><p class="product-description text-lg text-stone-600"></p></div></div></div>';
      fillGallery(page.querySelector('.product-gallery'), product);
      page.querySelector('h1').textContent = product.name;
      page.querySelector('.text-emerald-800').textContent = money(product.priceTtd) + ' each';
      page.querySelector('.product-description').textContent = product.description;
      page.querySelector('[data-cart-add]').setAttribute('data-cart-add', product.id);
      page.querySelector('.qty-input').setAttribute('aria-label', 'Quantity for ' + product.name);
      page.querySelector('.back').addEventListener('click', function () { page.classList.add('hidden'); });
      document.body.appendChild(page);
    });
    if (window.GlasticPay && window.GlasticPay.adoptCatalog) window.GlasticPay.adoptCatalog(products);
    openLinkedProduct();
  }

  function fillGallery(container, product) {
    var photos = product.photos || [];
    var photo = mainPhoto(product);
    if (!photo) {
      container.innerHTML = '<div class="rounded-3xl bg-stone-200 h-96"></div>';
      return;
    }
    var big = document.createElement('img');
    big.src = photo.url;
    big.alt = product.name + ' by Glastic Designs';
    big.className = 'rounded-3xl w-full object-cover h-96 product-photo';
    container.appendChild(big);
    if (photos.length < 2) return;
    var strip = document.createElement('div');
    strip.className = 'flex gap-2 mt-3 overflow-x-auto pb-1';
    photos.forEach(function (item) {
      var thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'rounded-xl overflow-hidden border-2 border-stone-200 p-0';
      thumb.style.width = '5rem';
      thumb.style.height = '5rem';
      thumb.style.flex = '0 0 auto';
      if (item.isMain) {
        thumb.classList.remove('border-stone-200');
        thumb.classList.add('border-emerald-600');
      }
      thumb.setAttribute('aria-label', 'Show photo of ' + product.name);
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.className = 'w-full h-full object-cover';
      thumb.appendChild(img);
      thumb.addEventListener('click', function () {
        big.src = item.url;
        var buttons = strip.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].classList.remove('border-emerald-600');
          buttons[i].classList.add('border-stone-200');
        }
        thumb.classList.remove('border-stone-200');
        thumb.classList.add('border-emerald-600');
      });
      strip.appendChild(thumb);
    });
    container.appendChild(strip);
  }

  function openLinkedProduct() {
    var id = '';
    try {
      id = new URLSearchParams(window.location.search).get('product') || '';
    } catch (error) {
      id = '';
    }
    if (!id && window.location.hash.indexOf('#product-') === 0) id = decodeURIComponent(window.location.hash.slice('#product-'.length));
    if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) return;
    var page = document.getElementById('page-' + id);
    if (page) page.classList.remove('hidden');
  }

  function load() {
    fetch('/api/products', { cache: 'no-store' }).then(function (res) {
      if (res.status === 503) return { products: FALLBACK };
      if (!res.ok) throw new Error('load');
      return res.json();
    }).then(function (data) {
      render(data.products || []);
    }).catch(function () {
      render(FALLBACK);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
