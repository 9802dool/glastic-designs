(function () {
  var AUTH_TIMEOUT_MS = 20000;
  var REDIRECT = '/?adminEdit=1&visualEdit=1';
  var TASKS_URL = '/admin/tasks.html';
  var gate = document.getElementById('gate');

  function api(url, options) {
    var opts = Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    }, options || {});
    var timeoutMs = opts.timeoutMs || 0;
    delete opts.timeoutMs;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller && timeoutMs > 0) {
      opts.signal = controller.signal;
      setTimeout(function () { controller.abort(); }, timeoutMs);
    }
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try { data = JSON.parse(text); } catch (e) {
            throw new Error('Unexpected server response (status ' + res.status + ').');
          }
        }
        if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), data);
        return data;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error('Request timed out.');
      throw err;
    });
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function showLoading(msg) {
    gate.hidden = false;
    gate.innerHTML = '<div class="gate-loading"><div class="spinner" aria-hidden="true"></div><p>' + esc(msg) + '</p></div>';
  }

  function showError(title, message) {
    console.error('[glastic-edit-gateway]', title, message);
    gate.innerHTML = '<div class="gate-panel"><h1>' + esc(title) + '</h1><p>' + esc(message)
      + '</p><div class="btn-row"><a class="btn btn-secondary" href="' + TASKS_URL + '">Quick tasks</a>'
      + '<button type="button" class="btn-primary" id="gate-retry">Try again</button></div></div>';
    document.getElementById('gate-retry').onclick = function () { location.reload(); };
  }

  function showSignIn(needsSetup) {
    gate.innerHTML = '<div class="gate-panel"><h1>' + (needsSetup ? 'Welcome' : 'Sign in') + '</h1><p>'
      + (needsSetup
        ? 'Choose a password for your shop admin, then open the click-to-edit site.'
        : 'Sign in with your shop password to edit your website.')
      + '</p><form id="gate-auth">'
      + '<label for="gate-password">' + (needsSetup ? 'New password' : 'Password') + '</label>'
      + '<input id="gate-password" type="password" autocomplete="' + (needsSetup ? 'new-password' : 'current-password') + '" minlength="8" required>'
      + (needsSetup
        ? '<label for="gate-confirm">Type it again</label><input id="gate-confirm" type="password" autocomplete="new-password" minlength="8" required>'
        : '')
      + '<p id="gate-auth-error" class="alert" hidden></p>'
      + '<div class="btn-row"><button type="submit" class="btn-primary">'
      + (needsSetup ? 'Continue' : 'Sign in') + '</button>'
      + '<a class="btn btn-secondary" href="' + TASKS_URL + '">Quick tasks menu</a></div></form></div>';
    document.getElementById('gate-auth').onsubmit = function (e) {
      e.preventDefault();
      var password = document.getElementById('gate-password').value;
      var errEl = document.getElementById('gate-auth-error');
      if (needsSetup && password !== document.getElementById('gate-confirm').value) {
        errEl.hidden = false;
        errEl.textContent = 'Those passwords do not match.';
        return;
      }
      errEl.hidden = true;
      showLoading('Signing in…');
      api('/api/admin/auth', {
        method: 'POST',
        body: JSON.stringify({ action: needsSetup ? 'setup' : 'login', password: password }),
        timeoutMs: AUTH_TIMEOUT_MS
      }).then(function () {
        window.location.replace(REDIRECT);
      }).catch(function (err) {
        showSignIn(needsSetup);
        errEl = document.getElementById('gate-auth-error');
        if (errEl) {
          errEl.hidden = false;
          errEl.textContent = (err && err.message) || 'Sign-in failed.';
        }
      });
    };
  }

  function boot() {
    showLoading('Opening editor…');
    api('/api/admin/auth', { timeoutMs: AUTH_TIMEOUT_MS }).then(function (state) {
      if (state.needsDatabase) {
        showError('Database not connected', 'Connect Neon in Vercel, then try again.');
        return;
      }
      if (!state.signedIn) {
        showSignIn(state.needsSetup);
        return;
      }
      console.info('[glastic-edit-gateway] redirect', REDIRECT);
      window.location.replace(REDIRECT);
    }).catch(function (err) {
      showError('Could not open editor', err.message || 'Auth check failed.');
    });
  }

  boot();
})();
