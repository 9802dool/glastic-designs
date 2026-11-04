(function () {
  var BLURB = {
    Tiles: 'Durable, waterproof wall and floor tiles made from plastic waste. Hexagonal, square, and rectangular shapes are available.',
    Planters: 'Living walls and vertical planters. We are nature\'s Keepers, planting walls for homes and outdoors in Trinidad and Tobago.',
    Furniture: 'Benches, stools, shelves, consoles, and tables for indoors, outdoors, classrooms, and patios.',
    Gifts: 'Coasters, clocks, trophies, medals, and keychains made from upcycled plastic.',
    Services: 'Refurbished school desks and chairs, and design consultations with the studio.'
  };

  function pathName() {
    return (location.pathname || '/').replace(/\/$/, '') || '/';
  }

  function linkOn(link) {
    var href = link.getAttribute('href');
    var path = pathName();
    if (link.getAttribute('data-match') === 'shop') return path === '/products' || path.indexOf('/category/') === 0;
    if (href === '/') return path === '/';
    return href === path;
  }

  function markActive() {
    var links = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < links.length; i++) {
      var on = linkOn(links[i]);
      links[i].classList.toggle('is-active', on);
      if (on) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  function shopCopy() {
    return window.GLASTIC_SHOP_COPY || null;
  }

  function describeShop() {
    var route = window.GLASTIC_ROUTE || { id: 'home' };
    var title = document.getElementById('products-title');
    var lead = document.getElementById('products-lead');
    if (!title || !lead) return;
    var copy = shopCopy();
    var blurbs = (copy && copy.categoryBlurbs) || BLURB;
    var titles = (copy && copy.categoryTitles) || {};
    if (route.id === 'category' && route.category) {
      title.textContent = titles[route.category] || route.category;
      lead.textContent = blurbs[route.category] || '';
    } else if (route.id === 'category') {
      title.textContent = 'Shop';
      lead.textContent = 'That category is not on this shop.';
    } else if (copy && route.id === 'products') {
      title.textContent = copy.title || title.textContent;
      lead.textContent = copy.lead || lead.textContent;
    }
  }

  window.GlasticNav = { refreshShopHeadings: describeShop };

  function closeMenu() {
    var menu = document.getElementById('mobile-menu');
    var button = document.getElementById('menu-open');
    if (menu) menu.hidden = true;
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'Menu';
    }
  }

  function openMenu() {
    var menu = document.getElementById('mobile-menu');
    var button = document.getElementById('menu-open');
    if (menu) menu.hidden = false;
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'Close';
    }
  }

  markActive();
  describeShop();
  var button = document.getElementById('menu-open');
  if (button) {
    button.addEventListener('click', function () {
      var menu = document.getElementById('mobile-menu');
      if (menu && menu.hidden) openMenu();
      else closeMenu();
    });
  }
  document.addEventListener('click', function (event) {
    var link = event.target.closest('#mobile-menu a');
    if (link) closeMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });
})();
