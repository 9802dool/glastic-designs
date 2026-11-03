(function () {
  var settings = null;
  var gallery = [];
  var meta = { fonts: [], presets: [] };
  var draftTheme = null;
  var notice = null;
  var saving = false;
  var panel = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function api(url, options) {
    return window.adminApi(url, options);
  }

  function showNotice(text, kind) {
    notice = { text: text, kind: kind || 'ok' };
  }

  function noticeHtml() {
    if (!notice) return '';
    return esc(notice.text);
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
          if (!blob) reject(new Error('Could not read that photo.'));
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

  function currentThemeDraft() {
    if (!settings) return null;
    if (!draftTheme) draftTheme = Object.assign({}, settings.theme);
    return draftTheme;
  }

  function applyPreviewTheme() {
    if (window.GLASTIC_APPLY_SETTINGS && settings) {
      var payload = { settings: Object.assign({}, settings, { theme: currentThemeDraft() }), gallery: gallery };
      window.GLASTIC_APPLY_SETTINGS(payload);
    }
  }

  function field(label, id, value, opts) {
    var o = opts || {};
    if (o.area) {
      return '<label class="field" for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '">' + esc(value || '') + '</textarea>';
    }
    return '<label class="field" for="' + id + '">' + esc(label) + '</label><input id="' + id + '" value="' + esc(value || '') + '">';
  }

  function toggleRow(key, label, on) {
    return '<label class="row" style="justify-content:space-between;margin:0.5rem 0"><span>' + esc(label) + '</span>'
      + '<input type="checkbox" data-vis="' + esc(key) + '"' + (on ? ' checked' : '') + '></label>';
  }

  function renderSitePanel(container, savebar, saveStatus, saveButton, titleEl) {
    panel = container;
    titleEl.textContent = 'Website look';
    savebar.hidden = false;
    document.body.classList.add('editing');
    saveButton.textContent = 'Save website changes';
    saveButton.disabled = false;
    var theme = currentThemeDraft();
    var hp = settings.homepage;
    var presetButtons = meta.presets.map(function (p) {
      var on = theme.preset === p.id ? ' chip-on' : '';
      return '<button type="button" class="' + on + '" data-preset="' + esc(p.id) + '">' + esc(p.label) + '</button>';
    }).join('');
    var fontOptions = meta.fonts.map(function (f) {
      var sel = theme.fontId === f.id ? ' selected' : '';
      return '<option value="' + esc(f.id) + '"' + sel + '>' + esc(f.label) + '</option>';
    }).join('');
    var steps = (hp.processSteps || []).map(function (step, i) {
      return '<div class="card" style="margin-top:0.5rem"><p class="muted">Step ' + (i + 1) + '</p>'
        + field('Title', 'step-title-' + i, step.title)
        + field('Description', 'step-text-' + i, step.text, { area: true })
        + '</div>';
    }).join('');
    var stats = (settings.impact.stats || []).map(function (stat, i) {
      return '<div class="split"><input id="stat-val-' + i + '" value="' + esc(stat.value) + '" placeholder="100%">'
        + '<input id="stat-label-' + i + '" value="' + esc(stat.label) + '" placeholder="Label"></div>';
    }).join('');
    var bullets = (settings.impact.bullets || []).join('\n');
    var galleryCards = gallery.map(function (item, index) {
      return '<article class="photo-card"><img class="preview" src="' + esc(item.url) + '" alt="">'
        + field('Caption', 'gal-cap-' + esc(item.id), item.caption)
        + '<div class="photo-actions"><label class="ghost file-btn">Replace<input type="file" accept="image/*" hidden data-gal-replace="' + esc(item.id) + '"></label>'
        + '<button class="danger" type="button" data-gal-del="' + esc(item.id) + '">Remove</button>'
        + '<div class="pair"><button class="quiet" type="button" data-gal-move="' + esc(item.id) + '" data-dir="-1"' + (index === 0 ? ' disabled' : '') + '>Up</button>'
        + '<button class="quiet" type="button" data-gal-move="' + esc(item.id) + '" data-dir="1"' + (index === gallery.length - 1 ? ' disabled' : '') + '>Down</button></div></div></article>';
    }).join('');

    container.innerHTML = '<button class="quiet" type="button" id="site-back">← Back</button>'
      + (notice ? '<div class="banner ' + esc(notice.kind) + '" role="status">' + noticeHtml() + '</div>' : '')
      + '<nav class="admin-tabs" aria-label="Website sections">'
      + '<button type="button" class="chip-on" data-tab="theme">Colours & logo</button>'
      + '<button type="button" data-tab="home">Homepage</button>'
      + '<button type="button" data-tab="impact">Impact</button>'
      + '<button type="button" data-tab="gallery">Gallery</button>'
      + '<button type="button" data-tab="contact">Contact</button>'
      + '<button type="button" data-tab="extras">Banner & sections</button>'
      + '</nav>'
      + '<div id="site-tab-theme" class="site-tab">'
      + '<section class="card"><h2>Ready-made themes</h2><div class="chips">' + presetButtons + '</div>'
      + '<p class="muted hint">Pick a preset, then fine-tune colours below. Use Preview to see it on the live site layout.</p>'
      + '<div class="split" style="margin-top:0.75rem"><button type="button" class="ghost" id="theme-preview">Preview</button>'
      + '<button type="button" class="danger" id="theme-reset">Reset colours to default</button></div></section>'
      + '<section class="card"><h2>Brand colours</h2>'
      + '<div class="split"><label class="field">Primary<input type="color" id="color-primary" value="' + esc(theme.primary) + '"></label>'
      + '<label class="field">Primary dark<input type="color" id="color-primary-dark" value="' + esc(theme.primaryDark) + '"></label></div>'
      + '<div class="split"><label class="field">Accent<input type="color" id="color-accent" value="' + esc(theme.accent) + '"></label>'
      + '<label class="field">Background<input type="color" id="color-bg" value="' + esc(theme.background) + '"></label></div>'
      + '<label class="field">Text<input type="color" id="color-text" value="' + esc(theme.text) + '"></label>'
      + '<label class="field" for="font-id">Fonts</label><select id="font-id">' + fontOptions + '</select>'
      + '<h2 style="margin-top:1rem">Logo</h2><img class="thumb" id="logo-preview" src="' + esc(theme.logoUrl || '/logo.svg') + '" alt="" style="width:6rem;height:6rem">'
      + '<label class="primary file-btn" style="margin-top:0.6rem">Upload logo<input type="file" accept="image/*" hidden id="logo-upload"></label></section>'
      + '</div>'
      + '<div id="site-tab-home" class="site-tab" hidden>'
      + '<section class="card"><h2>Hero</h2>' + field('Badge line', 'hero-badge', hp.heroBadge)
      + field('Headline (use Enter for a new line)', 'hero-headline', hp.heroHeadline, { area: true })
      + field('Subtext', 'hero-subtext', hp.heroSubtext, { area: true })
      + field('Badge note', 'hero-badge-note', hp.heroBadgeNote)
      + field('Badge caption', 'hero-badge-caption', hp.heroBadgeCaption)
      + '<img class="photo-card preview" src="' + esc(hp.heroImage) + '" alt="" style="height:10rem">'
      + '<label class="primary file-btn">Change hero photo<input type="file" accept="image/*" hidden id="hero-upload"></label></section>'
      + '<section class="card"><h2>About story</h2>' + field('Eyebrow', 'about-eyebrow', hp.aboutEyebrow)
      + field('Title', 'about-title', hp.aboutTitle) + field('Story', 'about-text', hp.aboutText, { area: true })
      + '<img class="photo-card preview" src="' + esc(hp.aboutImage) + '" alt="" style="height:10rem">'
      + '<label class="primary file-btn">Change about photo<input type="file" accept="image/*" hidden id="about-upload"></label></section>'
      + '<section class="card"><h2>How we make it</h2>' + steps + '</section>'
      + '</div>'
      + '<div id="site-tab-impact" class="site-tab" hidden>'
      + '<section class="card">' + field('Section title', 'impact-title', settings.impact.title)
      + field('Bullet points (one per line)', 'impact-bullets', bullets, { area: true })
      + '<h2 style="margin-top:1rem">Stat blocks</h2>' + stats + '</section></div>'
      + '<div id="site-tab-gallery" class="site-tab" hidden>'
      + '<section class="card">' + field('Gallery title', 'gallery-title', settings.gallery.title)
      + field('Gallery subtitle', 'gallery-subtitle', settings.gallery.subtitle, { area: true })
      + '<label class="primary file-btn">+ Add gallery photo<input type="file" accept="image/*" hidden id="gallery-add"></label>'
      + galleryCards + '</section></div>'
      + '<div id="site-tab-contact" class="site-tab" hidden>'
      + '<section class="card">' + field('Page title', 'contact-title', settings.contact.contactTitle)
      + field('Intro text', 'contact-lead', settings.contact.contactLead, { area: true })
      + field('WhatsApp number', 'contact-wa', settings.contact.whatsapp)
      + field('Facebook URL', 'contact-fb', settings.contact.facebook)
      + field('Instagram URL', 'contact-ig', settings.contact.instagram)
      + field('TikTok URL', 'contact-tiktok', settings.contact.tiktok)
      + field('YouTube URL', 'contact-yt', settings.contact.youtube)
      + field('Email (optional)', 'contact-email', settings.contact.email)
      + field('Opening hours (optional)', 'contact-hours', settings.contact.hours, { area: true })
      + '</section></div>'
      + '<div id="site-tab-extras" class="site-tab" hidden>'
      + '<section class="card"><h2>Announcement banner</h2>'
      + '<label class="row" style="justify-content:space-between;margin:0.5rem 0"><span>Show banner on the website</span>'
      + '<input type="checkbox" id="banner-enabled"' + (settings.banner.enabled ? ' checked' : '') + '></label>'
      + field('Banner text', 'banner-text', settings.banner.text)
      + field('Link (optional)', 'banner-link', settings.banner.link) + '</section>'
      + '<section class="card"><h2>Show sections on the website</h2>'
      + toggleRow('hero', 'Hero', settings.visibility.hero)
      + toggleRow('about', 'About', settings.visibility.about)
      + toggleRow('gallery', 'Gallery', settings.visibility.gallery)
      + toggleRow('products', 'Products', settings.visibility.products)
      + toggleRow('process', 'How we make it', settings.visibility.process)
      + toggleRow('impact', 'Impact', settings.visibility.impact)
      + toggleRow('contact', 'Contact', settings.visibility.contact)
      + toggleRow('consultation', 'Consultation booking box', settings.visibility.consultation)
      + '</section></div>';

    saveStatus.className = notice ? notice.kind : '';
    saveStatus.innerHTML = noticeHtml();

    container.querySelector('#site-back').onclick = function () {
      window.adminShowProducts();
    };
    container.querySelectorAll('.admin-tabs button').forEach(function (btn) {
      btn.onclick = function () {
        var tab = btn.getAttribute('data-tab');
        container.querySelectorAll('.admin-tabs button').forEach(function (b) { b.classList.toggle('chip-on', b === btn); });
        container.querySelectorAll('.site-tab').forEach(function (el) { el.hidden = el.id !== 'site-tab-' + tab; });
      };
    });
    container.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.onclick = function () {
        var preset = meta.presets.find(function (p) { return p.id === btn.getAttribute('data-preset'); });
        if (!preset) return;
        draftTheme = Object.assign({}, draftTheme || settings.theme, {
          preset: preset.id,
          primary: preset.primary,
          primaryDark: preset.primaryDark,
          accent: preset.accent,
          background: preset.background,
          text: preset.text
        });
        renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
      };
    });
    var colorPrimary = document.getElementById('color-primary');
    var colorPrimaryDark = document.getElementById('color-primary-dark');
    var colorAccent = document.getElementById('color-accent');
    var colorBg = document.getElementById('color-bg');
    var colorText = document.getElementById('color-text');
    function syncColorInput(input, key) {
      input.oninput = function () { currentThemeDraft()[key] = input.value; };
    }
    syncColorInput(colorPrimary, 'primary');
    syncColorInput(colorPrimaryDark, 'primaryDark');
    syncColorInput(colorAccent, 'accent');
    syncColorInput(colorBg, 'background');
    syncColorInput(colorText, 'text');
    document.getElementById('theme-preview').onclick = applyPreviewTheme;
    document.getElementById('theme-reset').onclick = async function () {
      try {
        var data = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'reset-theme' }) });
        settings.theme = data.theme;
        draftTheme = Object.assign({}, data.theme);
        showNotice('Colours reset to the default forest theme.', 'ok');
        renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
      } catch (error) {
        showNotice(error.message, 'bad');
        saveStatus.className = 'bad';
        saveStatus.textContent = error.message;
      }
    };
    bindUpload('logo-upload', async function (data) {
      var res = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'logo', data: data }) });
      settings = res.settings;
      draftTheme = Object.assign({}, settings.theme);
      showNotice('Logo updated.', 'ok');
      renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
    });
    bindUpload('hero-upload', async function (data) {
      var res = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'hero-image', data: data }) });
      settings = res.settings;
      showNotice('Hero photo updated.', 'ok');
      renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
    });
    bindUpload('about-upload', async function (data) {
      var res = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'about-image', data: data }) });
      settings = res.settings;
      showNotice('About photo updated.', 'ok');
      renderSitePanel(container, savebar, saveStatus, titleEl);
    });
    bindUpload('gallery-add', async function (data) {
      await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-photo', data: data }) });
      await reloadSiteData();
      showNotice('Gallery photo added.', 'ok');
      renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
    });
    container.querySelectorAll('[data-gal-replace]').forEach(function (input) {
      input.onchange = async function () {
        var file = (input.files || [])[0];
        input.value = '';
        if (!file) return;
        var id = input.getAttribute('data-gal-replace');
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-delete', id: id }) });
        var data = await blobToBase64(await compress(file));
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-photo', data: data, caption: document.getElementById('gal-cap-' + id).value }) });
        await reloadSiteData();
        showNotice('Photo replaced.', 'ok');
        renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
      };
    });
    container.querySelectorAll('[data-gal-del]').forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm('Remove this gallery photo?')) return;
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-delete', id: btn.getAttribute('data-gal-del') }) });
        await reloadSiteData();
        renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
      };
    });
    container.querySelectorAll('[data-gal-move]').forEach(function (btn) {
      btn.onclick = async function () {
        var id = btn.getAttribute('data-gal-move');
        var dir = Number(btn.getAttribute('data-dir'));
        var ids = gallery.map(function (g) { return g.id; });
        var index = ids.indexOf(id);
        var next = index + dir;
        if (next < 0 || next >= ids.length) return;
        var swap = ids[index];
        ids[index] = ids[next];
        ids[next] = swap;
        var res = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-reorder', ids: ids }) });
        gallery = res.gallery;
        renderSitePanel(container, savebar, saveStatus, saveButton, titleEl);
      };
    });

    saveButton.removeAttribute('form');
    saveButton.onclick = saveSite;
  }

  function bindUpload(id, handler) {
    var input = document.getElementById(id);
    if (!input) return;
    input.onchange = async function () {
      var file = (input.files || [])[0];
      input.value = '';
      if (!file) return;
      try {
        var data = await blobToBase64(await compress(file));
        await handler(data);
      } catch (error) {
        showNotice(error.message, 'bad');
      }
    };
  }

  function readVisibility() {
    var vis = Object.assign({}, settings.visibility);
    document.querySelectorAll('[data-vis]').forEach(function (input) {
      vis[input.getAttribute('data-vis')] = input.checked;
    });
    var bannerOn = document.getElementById('banner-enabled');
    return {
      visibility: vis,
      banner: {
        enabled: bannerOn ? bannerOn.checked : settings.banner.enabled,
        text: document.getElementById('banner-text').value,
        link: document.getElementById('banner-link').value
      }
    };
  }

  async function saveSite(event) {
    if (event) event.preventDefault();
    if (saving || !settings) return;
    saving = true;
    var saveButton = document.getElementById('save-button');
    var saveStatus = document.getElementById('save-status');
    saveButton.disabled = true;
    showNotice('Saving…', 'wait');
    saveStatus.className = 'wait';
    saveStatus.textContent = 'Saving…';
    try {
      var hp = settings.homepage;
      var steps = (hp.processSteps || []).map(function (_, i) {
        return {
          title: document.getElementById('step-title-' + i).value,
          text: document.getElementById('step-text-' + i).value
        };
      });
      var stats = (settings.impact.stats || []).map(function (_, i) {
        return {
          value: document.getElementById('stat-val-' + i).value,
          label: document.getElementById('stat-label-' + i).value
        };
      });
      var extra = readVisibility();
      var payload = {
        theme: Object.assign({}, currentThemeDraft(), { fontId: document.getElementById('font-id').value }),
        homepage: {
          heroBadge: document.getElementById('hero-badge').value,
          heroHeadline: document.getElementById('hero-headline').value,
          heroSubtext: document.getElementById('hero-subtext').value,
          heroBadgeNote: document.getElementById('hero-badge-note').value,
          heroBadgeCaption: document.getElementById('hero-badge-caption').value,
          aboutEyebrow: document.getElementById('about-eyebrow').value,
          aboutTitle: document.getElementById('about-title').value,
          aboutText: document.getElementById('about-text').value,
          processSteps: steps
        },
        gallery: {
          title: document.getElementById('gallery-title').value,
          subtitle: document.getElementById('gallery-subtitle').value
        },
        impact: {
          title: document.getElementById('impact-title').value,
          bullets: document.getElementById('impact-bullets').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
          stats: stats
        },
        contact: {
          contactTitle: document.getElementById('contact-title').value,
          contactLead: document.getElementById('contact-lead').value,
          whatsapp: document.getElementById('contact-wa').value,
          facebook: document.getElementById('contact-fb').value,
          instagram: document.getElementById('contact-ig').value,
          tiktok: document.getElementById('contact-tiktok').value,
          youtube: document.getElementById('contact-yt').value,
          email: document.getElementById('contact-email').value,
          hours: document.getElementById('contact-hours').value
        },
        banner: extra.banner,
        visibility: extra.visibility
      };
      for (var i = 0; i < gallery.length; i++) {
        var capEl = document.getElementById('gal-cap-' + gallery[i].id);
        if (capEl && capEl.value !== gallery[i].caption) {
          await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ action: 'gallery-caption', id: gallery[i].id, caption: capEl.value }) });
        }
      }
      var res = await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      settings = res.settings;
      gallery = res.gallery || gallery;
      draftTheme = Object.assign({}, settings.theme);
      showNotice('Saved. Your website updates right away.', 'ok');
      if (window.GLASTIC_APPLY_SETTINGS) window.GLASTIC_APPLY_SETTINGS({ settings: settings, gallery: gallery });
      renderSitePanel(panel, document.getElementById('savebar'), saveStatus, saveButton, document.getElementById('title'));
    } catch (error) {
      showNotice(error.message, 'bad');
      saveStatus.className = 'bad';
      saveStatus.textContent = error.message;
    } finally {
      saving = false;
      saveButton.disabled = false;
    }
  }

  async function reloadSiteData() {
    var data = await api('/api/admin/settings');
    settings = data.settings;
    gallery = data.gallery || [];
    meta.fonts = (data.meta && data.meta.fonts) || data.fonts || [];
    meta.presets = (data.meta && data.meta.presets) || data.presets || [];
    draftTheme = Object.assign({}, settings.theme);
  }

  window.adminShowSitePanel = async function () {
    notice = null;
    draftTheme = null;
    await reloadSiteData();
    renderSitePanel(
      document.getElementById('app'),
      document.getElementById('savebar'),
      document.getElementById('save-status'),
      document.getElementById('save-button'),
      document.getElementById('title')
    );
  };
})();
