(function () {
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

  function describeShop() {
    if (window.__glasticApplyShopTitles) window.__glasticApplyShopTitles();
  }

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
