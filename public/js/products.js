'use strict';
(function () {
  if (!window.jQuery || !window.ProductCatalog || !window.CommunityCart) {
    document.getElementById('catalog-message').textContent = 'Product tools could not load. Refresh this page to try again.';
    const retry = document.getElementById('retry-load');
    retry.classList.remove('d-none');
    retry.addEventListener('click', () => window.location.reload());
    return;
  }

  const $ = window.jQuery;
  $(function () {
    const catalog = window.ProductCatalog;
    const fields = ['name', 'description', 'category', 'unitOfMeasure', 'price'];
    const allFields = ['productId', ...fields];
    const dialog = document.getElementById('discard-dialog');
    const deleteDialog = document.getElementById('delete-product-dialog');
    let busy = false;
    let selected = null;
    let submitted = false;
    let ready = false;
    let savedSelection = false;
    let pendingAction = null;
    let creating = false;
    let draftStart = null;
    let returnToId = null;

    function inputValues() {
      return Object.fromEntries(allFields.map((name) => [name, $('#' + name).val()]));
    }

    function isDirty() {
      const input = inputValues();
      if (creating) return allFields.some((name) => input[name] !== draftStart[name]);
      if (!selected) return false;
      return fields.some((name) => name === 'price'
        ? input.price.trim() === '' || Number(input.price) !== selected.price
        : input[name] !== selected[name]);
    }

    function updateEditState() {
      const dirty = isDirty();
      $('#edit-state').toggleClass('is-dirty', dirty).text(!selected && !creating ? 'No selection' : (dirty ? 'Unsaved changes' : (creating ? 'New product' : (savedSelection ? (catalog.isShared() ? 'Saved to server' : 'Saved in browser') : 'Ready to edit'))));
      $('#save-hint').text(dirty ? 'Changes are not saved yet.' : (creating ? 'Fill in the details to add a product.' : 'No unsaved changes.'));
      $('#save-changes').prop('disabled', busy || !ready || (!creating && !dirty)).text(busy ? 'Saving...' : (creating ? 'Add product' : 'Save changes'));
      $('#discard-changes').prop('disabled', busy || (!creating && !dirty)).text(creating ? 'Cancel' : 'Discard');
      $('#export-products').prop('disabled', busy || !ready || creating || dirty)
        .attr('title', creating || dirty ? 'Save or cancel your edits before downloading.' : 'Download the saved product catalog.');
      $('#add-product-to-cart, #delete-product').prop('disabled', busy || !ready || !selected || creating || dirty)
        .attr('title', dirty || creating ? 'Save or discard the draft first.' : 'Use the saved product details.');
    }

    function setBusy(value) {
      busy = value;
      $('#product-form :input, #new-product, #clear-search, .product-choice').prop('disabled', value);
      $('#search-fields').prop('disabled', value);
      updateEditState();
    }

    function setErrors(errors) {
      for (const name of allFields) {
        const error = errors[name] || '';
        $('#' + name).toggleClass('is-invalid', Boolean(error)).attr('aria-invalid', String(Boolean(error)));
        $('#' + name + '-error').text(error);
      }
    }

    function showEditMessage(text, type) {
      $('#edit-message').removeClass('d-none alert-success alert-danger alert-info').addClass('alert-' + type).text(text);
    }

    function renderResults() {
      const results = catalog.search($('#search-query').val(), $('#category-filter').val());
      $('#product-list').empty();
      $('#catalog-count').text(catalog.getAll().length + ' resources');
      $('#result-count').text(results.length + (results.length === 1 ? ' product' : ' products') + ' found');
      $('#empty-results').toggleClass('d-none', results.length > 0);
      for (const product of results) {
        const $choice = $('<button>', {
          type: 'button', class: 'product-choice',
          'data-product-id': product.productId, disabled: busy,
          'aria-pressed': String(selected?.productId === product.productId),
          'aria-label': 'Edit ' + product.name + ', ' + product.productId + ', ' + catalog.money(product.price)
        });
        const $mark = $('<span>', { class: 'resource-mark', 'data-category': product.category, 'aria-hidden': 'true' }).text(product.category.charAt(0));
        const $copy = $('<span>', { class: 'product-choice-copy' });
        $('<span>', { class: 'product-choice-name' }).text(product.name).appendTo($copy);
        const $meta = $('<span>', { class: 'product-choice-meta' });
        $('<span>').text(product.productId).appendTo($meta);
        $('<span>', { class: 'meta-dot', 'aria-hidden': 'true' }).text(' · ').appendTo($meta);
        $('<span>').text(product.category).appendTo($meta);
        $copy.append($meta);
        const $price = $('<span>', { class: 'product-choice-price' }).text(catalog.money(product.price));
        $choice.append($mark, $copy, $price);
        // Product values are always text, never interpolated into HTML.
        $('<li>').append($choice).appendTo('#product-list');
      }
    }

    function chooseProduct(id, focusEditor = true) {
      selected = catalog.getById(id);
      if (!selected) return;
      creating = false;
      draftStart = null;
      submitted = false;
      savedSelection = false;
      $('#editor-placeholder').addClass('d-none');
      $('#editor-content').removeClass('d-none');
      $('#editor-title').text(selected.name);
      $('#productId').val(selected.productId).prop('readOnly', true);
      $('#productId-help').text('A permanent reference for this resource.');
      for (const name of fields) $('#' + name).val(name === 'price' ? selected.price.toFixed(2) : selected[name]);
      $('#edit-message').addClass('d-none');
      setErrors({});
      updateEditState();
      renderResults();
      if (focusEditor) document.getElementById('editor-title').focus();
    }

    function startNewProduct() {
      if (!creating) returnToId = selected?.productId || null;
      creating = true;
      selected = null;
      submitted = false;
      savedSelection = false;
      draftStart = Object.fromEntries(allFields.map((name) => [name, name === 'productId' ? catalog.nextId() : '']));
      $('#editor-placeholder, #edit-message').addClass('d-none');
      $('#editor-content').removeClass('d-none');
      $('#editor-title').text('Add a new resource');
      for (const name of allFields) $('#' + name).val(draftStart[name]);
      $('#productId').prop('readOnly', false);
      $('#productId-help').text('Use a unique ID: P followed by three digits.');
      setErrors({});
      updateEditState();
      renderResults();
      document.getElementById('editor-title').focus();
    }

    function cancelNewProduct() {
      const previous = catalog.getById(returnToId) || catalog.getAll()[0];
      if (previous) { chooseProduct(previous.productId); return; }
      creating = false;
      selected = null;
      draftStart = null;
      $('#editor-content').addClass('d-none');
      $('#editor-placeholder').removeClass('d-none');
      $('#editor-title').text('Choose a product');
      updateEditState();
      $('#edit-state').text('No selection');
    }

    function confirmLeave(action) {
      if (busy) { showEditMessage('Please wait for the current product request to finish.', 'info'); return; }
      if (!isDirty()) { action(); return; }
      pendingAction = action;
      dialog.showModal();
    }

    function showSearchResults() {
      renderResults();
      const results = catalog.search($('#search-query').val(), $('#category-filter').val());
      // An ID search opens its details. Other searches leave the current editor intact.
      if (results.length === 1 && $('#search-query').val().trim().toUpperCase() === results[0].productId) {
        if (selected?.productId !== results[0].productId) confirmLeave(() => chooseProduct(results[0].productId));
      }
    }

    function loadProducts() {
      ready = false;
      $('#search-fields').prop('disabled', true);
      $('#clear-search, #export-products, #new-product').prop('disabled', true);
      $('#retry-load, #catalog-notice').addClass('d-none');
      $('#catalog-message').removeClass('is-error').text('Loading products...');
      catalog.load().then(function (products) {
        ready = true;
        $('#search-fields').prop('disabled', false);
        $('#clear-search, #export-products, #new-product').prop('disabled', false);
        $('#catalog-message').text('');
        const notice = catalog.getNotice();
        if (notice) $('#catalog-notice').removeClass('d-none').text(notice);
        $('#catalog-storage-note').text(catalog.isShared()
          ? 'Products are shared through the project server. Download JSON to keep a file copy.'
          : 'Static demo: product edits stay in this browser. Start the Node server for shared products and HTTP requests.');
        if (products.length) chooseProduct(products[0].productId, false);
        else {
          renderResults();
          $('#edit-state').text('No selection');
          $('#editor-placeholder p').first().text('Your catalog is empty.');
        }
      }).catch(function () {
        $('#catalog-count').text('Unavailable');
        $('#result-count').text('Products could not be loaded');
        $('#catalog-message').addClass('is-error').text('Could not load products. Check your connection and try again.');
        $('#retry-load').removeClass('d-none');
      });
    }

    for (const category of catalog.categories) {
      $('<option>', { value: category }).text(category).appendTo('#category-filter');
      $('<option>', { value: category }).text(category).appendTo('#category');
    }
    for (const unit of catalog.units) $('<option>', { value: unit }).text(unit).appendTo('#unitOfMeasure');

    $('#search-form').on('submit', function (event) { event.preventDefault(); if (ready) showSearchResults(); });
    $('#category-filter').on('change', function () { if (ready) showSearchResults(); });
    $('#search-query').on('input', function () { if (ready && this.value === '') renderResults(); });
    $('#clear-search').on('click', function () {
      $('#search-query, #category-filter').val('');
      renderResults();
      $('#search-query').trigger('focus');
    });
    $('#product-list').on('click', '.product-choice', function () {
      const id = $(this).attr('data-product-id');
      if (selected?.productId !== id) confirmLeave(() => chooseProduct(id));
      else document.getElementById('editor-title').focus();
    });

    $('#product-form').on('input change', function () {
      updateEditState();
      if (submitted) setErrors(catalog.validate(inputValues(), { creating }).errors);
      $('#edit-message').addClass('d-none');
    });
    $('#product-form').on('submit', async function (event) {
      event.preventDefault();
      if (busy || (!selected && !creating) || (!creating && !isDirty())) return;
      submitted = true;
      const result = catalog.validate(inputValues(), { creating });
      setErrors(result.errors);
      if (!result.valid) {
        showEditMessage('Please check the highlighted fields.', 'danger');
        $('#product-form .is-invalid').first().trigger('focus');
        return;
      }
      setBusy(true);
      try {
        const wasCreating = creating;
        selected = creating ? await catalog.create(result.product) : await catalog.update(selected.productId, result.product, selected);
        creating = false;
        draftStart = null;
        $('#productId').val(selected.productId).prop('readOnly', true);
        $('#productId-help').text('A permanent reference for this resource.');
        for (const name of fields) $('#' + name).val(name === 'price' ? selected.price.toFixed(2) : selected[name]);
        $('#editor-title').text(selected.name);
        savedSelection = true;
        submitted = false;
        $('#catalog-notice').addClass('d-none');
        showEditMessage(selected.productId + (wasCreating ? ' added.' : ' updated.') + (catalog.isShared() ? ' Saved to the project server.' : ' Saved in this browser.'), 'success');
        if (wasCreating) $('#search-query, #category-filter').val('');
        renderResults();
      } catch (error) {
        showEditMessage(error.message, 'danger');
      } finally {
        setBusy(false);
      }
    });

    $('#discard-changes').on('click', function () {
      if (creating) confirmLeave(cancelNewProduct);
      else if (selected && isDirty()) confirmLeave(() => chooseProduct(selected.productId));
    });
    $('#new-product').on('click', function () { if (ready) confirmLeave(startNewProduct); });
    $('#keep-editing').on('click', function () { pendingAction = null; dialog.close(); });
    $('#confirm-discard').on('click', function () {
      const action = pendingAction;
      pendingAction = null;
      dialog.close();
      if (action) action();
    });
    dialog.addEventListener('cancel', () => { pendingAction = null; });
    $('a[href]').on('click', function (event) {
      if ((!isDirty() && !busy) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const destination = new URL(this.href);
      if (destination.pathname === window.location.pathname && destination.hash) return;
      event.preventDefault();
      confirmLeave(() => { selected = null; creating = false; window.location.href = destination.href; });
    });
    window.addEventListener('beforeunload', function (event) {
      if (isDirty() || busy) { event.preventDefault(); event.returnValue = ''; }
    });

    $('#export-products').on('click', function () {
      if (!ready || creating || isDirty()) return;
      const blob = new Blob([catalog.toJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'products.json';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('#add-product-to-cart').on('click', function () {
      if (!selected || creating || isDirty() || busy) return;
      try {
        const quantity = window.CommunityCart.add(selected.productId);
        showEditMessage(selected.name + ' added to your cart. Quantity: ' + quantity + '. Open Cart to review it.', 'success');
      } catch (error) { showEditMessage(error.message, 'danger'); }
    });
    $('#delete-product').on('click', function () {
      if (!selected || creating || isDirty() || busy) return;
      $('#delete-product-name').text(selected.name);
      deleteDialog.showModal();
    });
    $('#cancel-delete-product').on('click', () => deleteDialog.close());
    $('#confirm-delete-product').on('click', async function () {
      if (!selected || busy) return;
      const removed = selected;
      deleteDialog.close();
      setBusy(true);
      try {
        await catalog.remove(removed.productId, removed);
        selected = null;
        $('#search-query, #category-filter').val('');
        const next = catalog.getAll()[0];
        if (next) chooseProduct(next.productId);
        else {
          $('#editor-content').addClass('d-none');
          $('#editor-placeholder').removeClass('d-none');
          $('#editor-title').text('Choose a product');
          $('#edit-state').text('No selection');
          renderResults();
        }
        $('#catalog-message').text(removed.productId + ' deleted from the catalog.');
      } catch (error) { showEditMessage(error.message, 'danger'); }
      finally { setBusy(false); }
    });
    $('#retry-load').on('click', loadProducts);
    loadProducts();
  });
})();
