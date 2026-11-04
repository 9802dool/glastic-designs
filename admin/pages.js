(function (global) {
  var CATEGORIES = ['Tiles', 'Planters', 'Furniture', 'Gifts', 'Services'];

  var PAGE_LIST = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'shop', label: 'Shop & categories' },
    { id: 'process', label: 'Process' },
    { id: 'impact', label: 'Impact' },
    { id: 'contact', label: 'Contact' },
    { id: 'cart', label: 'Cart' },
    { id: 'footer', label: 'Footer' }
  ];

  function fieldGroups(pageId) {
    if (pageId === 'home') {
      return [{ title: 'Hero', fields: [
        { key: 'heroBadge', label: 'Badge line', type: 'text' },
        { key: 'heroHeadline', label: 'Main heading', type: 'textarea', lines: true },
        { key: 'heroSubtext', label: 'Paragraph', type: 'textarea' },
        { key: 'exploreLabel', label: 'Primary button', type: 'text' },
        { key: 'heroImage', label: 'Hero photo', type: 'image' },
        { key: 'heroBadgeNote', label: 'Photo badge (large)', type: 'text' },
        { key: 'heroBadgeCaption', label: 'Photo badge (caption)', type: 'text' }
      ]}];
    }
    if (pageId === 'about') {
      return [{ title: 'Intro', fields: [
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'title', label: 'Main heading', type: 'text' },
        { key: 'text', label: 'Paragraph', type: 'textarea' },
        { key: 'image', label: 'Photo', type: 'image' }
      ]}, { title: 'Feature cards', fields: [
        { key: 'feature0Title', label: 'Card 1 title', type: 'text' },
        { key: 'feature0Text', label: 'Card 1 text', type: 'textarea' },
        { key: 'feature1Title', label: 'Card 2 title', type: 'text' },
        { key: 'feature1Text', label: 'Card 2 text', type: 'textarea' },
        { key: 'feature2Title', label: 'Card 3 title', type: 'text' },
        { key: 'feature2Text', label: 'Card 3 text', type: 'textarea' }
      ]}, { title: 'Plant graphic', fields: [
        { key: 'plantImage', label: 'Photo', type: 'image' },
        { key: 'plantCaption', label: 'Caption', type: 'text' }
      ]}];
    }
    if (pageId === 'gallery') {
      return [{ title: 'Page text', fields: [
        { key: 'title', label: 'Main heading', type: 'text' },
        { key: 'subtitle', label: 'Paragraph', type: 'textarea' }
      ]}, { title: 'Photos', gallery: true }];
    }
    if (pageId === 'shop') {
      var catFields = [];
      CATEGORIES.forEach(function (cat) {
        catFields.push({ key: 'categoryTitles.' + cat, label: cat + ' tab title', type: 'text', map: 'categoryTitles', mapKey: cat });
        catFields.push({ key: 'categoryBlurbs.' + cat, label: cat + ' blurb', type: 'textarea', map: 'categoryBlurbs', mapKey: cat });
      });
      return [{ title: 'Shop page', fields: [
        { key: 'title', label: 'Main heading', type: 'text' },
        { key: 'lead', label: 'Paragraph', type: 'textarea' },
        { key: 'demoNote', label: 'Demo note', type: 'textarea' }
      ]}, { title: 'Category pages', fields: catFields }];
    }
    if (pageId === 'process') {
      var steps = [];
      for (var i = 0; i < 4; i++) {
        steps.push({ key: 'step' + i + 'Title', label: 'Step ' + (i + 1) + ' title', type: 'text' });
        steps.push({ key: 'step' + i + 'Text', label: 'Step ' + (i + 1) + ' text', type: 'textarea' });
      }
      return [{ title: 'Process', fields: [{ key: 'title', label: 'Main heading', type: 'text' }].concat(steps) }];
    }
    if (pageId === 'impact') {
      var bullets = [];
      for (var b = 0; b < 4; b++) bullets.push({ key: 'bullet' + b, label: 'Bullet ' + (b + 1), type: 'textarea' });
      var stats = [];
      for (var s = 0; s < 4; s++) {
        stats.push({ key: 'stat' + s + 'Value', label: 'Stat ' + (s + 1) + ' value', type: 'text' });
        stats.push({ key: 'stat' + s + 'Label', label: 'Stat ' + (s + 1) + ' label', type: 'text' });
      }
      return [{ title: 'Impact', fields: [{ key: 'title', label: 'Main heading', type: 'text' }].concat(bullets) }, { title: 'Stats', fields: stats }];
    }
    if (pageId === 'contact') {
      return [{ title: 'Contact', fields: [
        { key: 'title', label: 'Main heading', type: 'text' },
        { key: 'lead', label: 'Paragraph', type: 'textarea' },
        { key: 'whatsappLabel', label: 'WhatsApp button', type: 'text' },
        { key: 'facebookLabel', label: 'Facebook button', type: 'text' }
      ]}, { title: 'Consultation card', fields: [
        { key: 'consultEyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'consultTitle', label: 'Title', type: 'text' },
        { key: 'consultLead', label: 'Paragraph', type: 'textarea' },
        { key: 'consultDeposit', label: 'Deposit amount', type: 'text' },
        { key: 'consultDepositLabel', label: 'Deposit label', type: 'text' },
        { key: 'consultPayButton', label: 'Pay button', type: 'text' },
        { key: 'consultWaButton', label: 'WhatsApp button', type: 'text' },
        { key: 'consultNote', label: 'Demo note', type: 'text' }
      ]}];
    }
    if (pageId === 'cart') {
      return [{ title: 'Cart page & drawer', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'intro', label: 'Intro', type: 'textarea' },
        { key: 'emptyText', label: 'Empty message', type: 'textarea' },
        { key: 'subtotalLabel', label: 'Subtotal label', type: 'text' },
        { key: 'checkoutButton', label: 'Checkout button', type: 'text' },
        { key: 'checkoutNote', label: 'Checkout note', type: 'text' },
        { key: 'continueLabel', label: 'Continue shopping link', type: 'text' }
      ]}];
    }
    if (pageId === 'footer') {
      return [{ title: 'Footer', fields: [
        { key: 'brand', label: 'Brand line', type: 'text' },
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'subline', label: 'Subline', type: 'text' },
        { key: 'copyright', label: 'Copyright', type: 'textarea' }
      ]}];
    }
    return [];
  }

  function readFieldValue(page, field) {
    if (field.map) return (page[field.map] && page[field.map][field.mapKey]) || '';
    return page[field.key] || '';
  }

  function writeFieldValue(page, field, value) {
    if (field.map) {
      if (!page[field.map]) page[field.map] = {};
      page[field.map][field.mapKey] = value;
      return;
    }
    page[field.key] = value;
  }

  function init(opts) {
    var api = opts.api;
    var esc = opts.esc;
    var app = opts.app;
    var savebar = opts.savebar;
    var saveStatus = opts.saveStatus;
    var saveButton = opts.saveButton;
    var titleEl = opts.titleEl;
    var state = { payload: null, pageId: 'home', draft: null, saving: false };

    function mergedPage(pageId) {
      var defs = state.payload.defaults[pageId] || {};
      var saved = (state.payload.pages_v2 && state.payload.pages_v2[pageId]) || {};
      return Object.assign({}, defs, saved);
    }

    function setStatus(text, kind) {
      saveStatus.className = kind || '';
      saveStatus.textContent = text || '';
    }

    function readDraftFromForm() {
      var page = Object.assign({}, state.draft);
      app.querySelectorAll('[data-field]').forEach(function (input) {
        var spec = JSON.parse(input.getAttribute('data-field'));
        writeFieldValue(page, spec, input.value);
      });
      return page;
    }

    async function savePage() {
      if (state.saving) return;
      state.saving = true;
      saveButton.disabled = true;
      setStatus('Saving…', 'wait');
      try {
        var page = readDraftFromForm();
        state.payload = await api('/api/admin/settings', {
          method: 'PATCH',
          body: JSON.stringify({ pageId: state.pageId, page: page })
        });
        state.draft = mergedPage(state.pageId);
        setStatus('Saved. Changes are live on the website.', 'ok');
        render();
      } catch (error) {
        setStatus(error.message || 'Could not save.', 'bad');
      } finally {
        state.saving = false;
        saveButton.disabled = false;
      }
    }

    async function uploadPageImage(field, file) {
      if (!file) return;
      setStatus('Uploading photo…', 'wait');
      var reader = new FileReader();
      reader.onload = async function () {
        var base64 = String(reader.result || '').split(',')[1] || '';
        try {
          state.payload = await api('/api/admin/settings', {
            method: 'POST',
            body: JSON.stringify({ action: 'page-image', pageId: state.pageId, field: field.key, data: base64 })
          });
          state.draft = mergedPage(state.pageId);
          setStatus('Photo updated.', 'ok');
          render();
        } catch (error) {
          setStatus(error.message || 'Upload failed.', 'bad');
        }
      };
      reader.readAsDataURL(file);
    }

    async function galleryAction(body) {
      setStatus('Updating gallery…', 'wait');
      try {
        state.payload = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(body) });
        setStatus('Gallery updated.', 'ok');
        render();
      } catch (error) {
        setStatus(error.message || 'Gallery update failed.', 'bad');
      }
    }

    function gallerySection() {
      var photos = state.payload.gallery || [];
      var cards = photos.map(function (photo, index) {
        return '<article class="photo-card" data-gallery-id="' + esc(photo.id) + '">'
          + '<img class="preview" src="' + esc(photo.url) + '" alt="">'
          + '<label class="field" for="cap-' + esc(photo.id) + '">Caption</label>'
          + '<input id="cap-' + esc(photo.id) + '" data-gallery-caption="' + esc(photo.id) + '" value="' + esc(photo.caption || '') + '">'
          + '<div class="photo-actions"><div class="pair">'
          + '<button type="button" class="quiet" data-gallery-up="' + esc(photo.id) + '"' + (index === 0 ? ' disabled' : '') + '>Up</button>'
          + '<button type="button" class="quiet" data-gallery-down="' + esc(photo.id) + '"' + (index === photos.length - 1 ? ' disabled' : '') + '>Down</button>'
          + '</div>'
          + '<button type="button" class="danger" data-gallery-del="' + esc(photo.id) + '">Remove</button></div></article>';
      }).join('');
      return '<section class="card"><h2>Gallery photos</h2>'
        + '<p class="muted hint">Reorder, caption, add or remove. Saving page text is separate — use Save below for headings.</p>'
        + '<label class="primary file-btn">+ Add photo<input type="file" accept="image/*" hidden id="gallery-add"></label>'
        + (cards || '<p class="muted hint">No photos yet.</p>')
        + '</section>';
    }

    function render() {
      document.body.classList.add('editing');
      savebar.hidden = false;
      saveButton.textContent = 'Save page';
      saveButton.type = 'button';
      saveButton.onclick = savePage;
      titleEl.textContent = 'Pages';
      state.draft = mergedPage(state.pageId);
      var groups = fieldGroups(state.pageId);
      var picker = '<div class="chips" role="tablist">' + PAGE_LIST.map(function (p) {
        var on = p.id === state.pageId ? ' chip-on' : '';
        return '<button type="button" class="' + on + '" data-page="' + esc(p.id) + '">' + esc(p.label) + '</button>';
      }).join('') + '</div>';
      var body = picker;
      var cardOpen = false;
      groups.forEach(function (group) {
        if (group.gallery) {
          if (cardOpen) { body += '</div>'; cardOpen = false; }
          body += gallerySection();
          return;
        }
        if (!cardOpen) { body += '<div class="card">'; cardOpen = true; }
        body += '<h2>' + esc(group.title) + '</h2>';
        group.fields.forEach(function (field) {
          var val = readFieldValue(state.draft, field);
          var spec = esc(JSON.stringify(field));
          var fid = 'f-' + (field.map ? field.map + '-' + field.mapKey : field.key);
          if (field.type === 'image') {
            body += '<label class="field">' + esc(field.label) + '</label>'
              + '<img class="preview" style="height:10rem;margin-bottom:0.5rem" src="' + esc(val || '/images/living-wall.jpg') + '" alt="">'
              + '<label class="ghost file-btn">Replace photo<input type="file" accept="image/*" hidden data-image-field="' + esc(field.key) + '"></label>';
            return;
          }
          if (field.type === 'textarea') {
            body += '<label class="field" for="' + esc(fid) + '">' + esc(field.label) + '</label>'
              + '<textarea id="' + esc(fid) + '" data-field="' + spec + '">' + esc(val) + '</textarea>';
            return;
          }
          body += '<label class="field" for="' + esc(fid) + '">' + esc(field.label) + '</label>'
            + '<input id="' + esc(fid) + '" data-field="' + spec + '" value="' + esc(val) + '">';
        });
      });
      if (cardOpen) body += '</div>';
      app.innerHTML = body;

      app.querySelectorAll('[data-page]').forEach(function (btn) {
        btn.onclick = function () {
          state.pageId = btn.getAttribute('data-page');
          state.draft = mergedPage(state.pageId);
          render();
        };
      });
      app.querySelectorAll('[data-image-field]').forEach(function (input) {
        input.onchange = function () {
          var key = input.getAttribute('data-image-field');
          var field = { key: key };
          uploadPageImage(field, input.files && input.files[0]);
          input.value = '';
        };
      });
      var add = document.getElementById('gallery-add');
      if (add) {
        add.onchange = function () {
          var file = add.files && add.files[0];
          add.value = '';
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            var base64 = String(reader.result || '').split(',')[1] || '';
            galleryAction({ action: 'gallery-photo', data: base64, caption: '' });
          };
          reader.readAsDataURL(file);
        };
      }
      app.querySelectorAll('[data-gallery-del]').forEach(function (btn) {
        btn.onclick = function () {
          if (!confirm('Remove this gallery photo?')) return;
          galleryAction({ action: 'gallery-delete', id: btn.getAttribute('data-gallery-del') });
        };
      });
      app.querySelectorAll('[data-gallery-up],[data-gallery-down]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-gallery-up') || btn.getAttribute('data-gallery-down');
          var ids = (state.payload.gallery || []).map(function (p) { return p.id; });
          var idx = ids.indexOf(id);
          var dir = btn.hasAttribute('data-gallery-up') ? -1 : 1;
          var next = idx + dir;
          if (idx < 0 || next < 0 || next >= ids.length) return;
          var swap = ids[idx];
          ids[idx] = ids[next];
          ids[next] = swap;
          galleryAction({ action: 'gallery-reorder', ids: ids });
        };
      });
      app.querySelectorAll('[data-gallery-caption]').forEach(function (input) {
        input.onchange = function () {
          galleryAction({ action: 'gallery-caption', id: input.getAttribute('data-gallery-caption'), caption: input.value });
        };
      });
    }

    return {
      open: async function () {
        setStatus('', '');
        state.payload = await api('/api/admin/settings');
        state.pageId = 'home';
        render();
      }
    };
  }

  global.GlasticPagesAdmin = { init: init };
})(window);
