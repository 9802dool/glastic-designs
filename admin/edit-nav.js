(function () {
  function isAdminEditSession() {
    try {
      return /(?:\?|&)adminEdit=1(?:&|$)/.test(window.location.search || '')
        && /(?:\?|&)visualEdit=1(?:&|$)/.test(window.location.search || '');
    } catch (e) {
      return false;
    }
  }

  function withEditParams(href) {
    if (!href || href.charAt(0) === '#') return href;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return href;
    var url;
    try {
      url = new URL(href, window.location.origin);
    } catch (e) {
      return href;
    }
    if (url.origin !== window.location.origin) return href;
    url.searchParams.set('adminEdit', '1');
    url.searchParams.set('visualEdit', '1');
    return url.pathname + url.search + url.hash;
  }

  function patchLinks(root) {
    if (!isAdminEditSession()) return;
    var scope = root || document;
    scope.querySelectorAll('a[href]').forEach(function (a) {
      if (a.closest('#glastic-edit-toolbar')) return;
      var href = a.getAttribute('href');
      if (!href || href.indexOf('adminEdit=1') >= 0) return;
      var next = withEditParams(href);
      if (next !== href) a.setAttribute('href', next);
    });
  }

  if (!isAdminEditSession()) return;

  function boot() {
    patchLinks(document);
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var mo = new MutationObserver(function () { patchLinks(document); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('click', function (event) {
      var a = event.target.closest && event.target.closest('a[href]');
      if (!a || a.closest('#glastic-edit-toolbar, .glastic-edit-popover')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      try {
        var url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.searchParams.get('adminEdit') !== '1') {
          url.searchParams.set('adminEdit', '1');
          url.searchParams.set('visualEdit', '1');
          a.setAttribute('href', url.pathname + url.search + url.hash);
        }
      } catch (e) { /* ignore */ }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
