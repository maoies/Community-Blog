'use strict';
(function ($) {
  if (!$ || !window.ProductCatalog || !window.CommunityCart) {
    document.getElementById('cart-loading').textContent = 'Cart tools could not load. Refresh this page to try again.';
    document.getElementById('browse-message').textContent = 'The resource scripts could not be loaded.';
    const retry = document.getElementById('retry-catalog');
    retry.classList.remove('d-none');
    retry.addEventListener('click', () => window.location.reload());
    return;
  }
  $(function () {
    const catalog = window.ProductCatalog;
    const cart = window.CommunityCart;
    const clearDialog = document.getElementById('clear-cart-dialog');
    const previewDialog = document.getElementById('cart-preview-dialog');
    let ready = false;
    let preparing = false;
    let prepared = null;
    let lastRemoved = null;

    function announce(text, type = 'success', undo = false) {
      $('#cart-feedback').removeClass('d-none alert-success alert-danger alert-info').addClass('alert-' + type);
      $('#cart-feedback-text').text(text);
      $('#undo-remove').toggleClass('d-none', !undo);
    }
    function storageError(error) {
      $('#cart-loading').addClass('d-none');
      $('#cart-storage-error').removeClass('d-none');
      $('#cart-storage-message').text(error.message);
      $('#prepare-cart, #clear-cart').prop('disabled', true);
    }
    function hasDraft() {
      return $('#cart-items input[data-saved-quantity]').toArray().some((input) => input.value !== input.dataset.savedQuantity);
    }
    function invalidatePrepared() { prepared = null; }
    function updatePrepareState() {
      let items = [];
      try { items = cart.read(); } catch { /* The storage panel supplies the recovery action. */ }
      const available = ready && items.length && items.every((item) => catalog.getById(item.productId));
      $('#prepare-cart').prop('disabled', preparing || !available || hasDraft()).text(preparing ? 'Preparing...' : 'Prepare cart data →');
      if (hasDraft()) $('#summary-note').text('Select Update to apply your new quantity before preparing the cart.');
      else $('#summary-note').text(items.some((item) => ready && !catalog.getById(item.productId))
        ? 'Totals exclude unavailable items. Remove them before preparing your cart.'
        : items.length ? 'Review quantities above. Your selection is saved in this browser.' : 'Add a resource to get started.');
    }
    function mark(product) {
      return $('<span>', { class: 'resource-mark', 'data-category': product.category, 'aria-hidden': 'true' }).text(product.category.charAt(0));
    }
    function renderCart(focusId) {
      const drafts = new Map($('#cart-items input[data-saved-quantity]').toArray()
        .filter((input) => input.value !== input.dataset.savedQuantity)
        .map((input) => [input.id, { value: input.value, saved: input.dataset.savedQuantity,
          invalid: input.classList.contains('is-invalid'), error: document.getElementById(input.getAttribute('aria-describedby'))?.textContent || '' }]));
      invalidatePrepared();
      let entries;
      try { entries = cart.read(); $('#cart-storage-error').addClass('d-none'); }
      catch (error) { storageError(error); return; }
      $('#cart-loading').addClass('d-none');
      $('#cart-items').empty();
      $('#cart-empty').toggleClass('d-none', entries.length > 0);
      $('#cart-panel-footer').toggleClass('d-none', entries.length === 0);
      $('#clear-cart').prop('disabled', !entries.length);
      let totalCents = 0;
      let totalQuantity = 0;
      let unavailable = false;
      for (const entry of entries) {
        const product = catalog.getById(entry.productId);
        totalQuantity += entry.quantity;
        const $row = $('<li>', { class: 'cart-line', 'data-cart-id': entry.productId });
        const $copy = $('<div>', { class: 'cart-line-copy' });
        $('<h3>').text(product?.name || 'Unavailable resource').appendTo($copy);
        $('<p>', { class: 'cart-line-meta' }).text(product
          ? `${product.productId} · ${product.category} · ${product.unitOfMeasure}`
          : entry.productId + ' · This resource was removed from the catalog.').appendTo($copy);
        if (product) {
          const id = 'quantity-' + entry.productId;
          const errorId = 'quantity-error-' + entry.productId;
          const $form = $('<form>', { class: 'cart-quantity-form', novalidate: true, 'data-product-id': entry.productId });
          const $field = $('<div>');
          $('<label>', { class: 'form-label', for: id }).text('Quantity').appendTo($field);
          $('<input>', {
            class: 'form-control', type: 'number', id, name: 'quantity', min: 1, max: 99, step: 1,
            required: true, inputmode: 'numeric', value: entry.quantity,
            'aria-label': 'Quantity for ' + product.name, 'aria-describedby': errorId,
            'data-saved-quantity': String(entry.quantity)
          }).appendTo($field);
          $form.append($field);
          $('<button>', { class: 'btn btn-outline-secondary', type: 'submit', 'aria-label': 'Update quantity for ' + product.name }).text('Update').appendTo($form);
          $('<p>', { class: 'quantity-error', id: errorId, role: 'status' }).appendTo($form);
          $('<p>', { class: 'quantity-draft-note' }).text('Select Update to apply this quantity.').appendTo($form);
          $copy.append($form);
          const draft = drafts.get(id);
          if (draft && draft.saved === String(entry.quantity)) {
            $field.find('input').val(draft.value);
            $field.find('input').toggleClass('is-invalid', draft.invalid).attr('aria-invalid', String(draft.invalid));
            $form.find('.quantity-error').text(draft.error);
            $form.find('.quantity-draft-note').addClass('is-visible');
          }
        } else {
          unavailable = true;
          $('<p>', { class: 'cart-unavailable mb-0' }).text('Remove this item to prepare your cart.').appendTo($copy);
        }
        $('<button>', {
          class: 'remove-cart-item', type: 'button', 'data-remove-id': entry.productId,
          'aria-label': 'Remove ' + (product?.name || entry.productId) + ' from cart'
        }).text('Remove').appendTo($copy);
        const cents = product ? Math.round(product.price * 100) * entry.quantity : 0;
        totalCents += cents;
        const $price = $('<p>', { class: 'cart-line-price' }).text(product ? catalog.money(cents / 100) : '—');
        if (product) $('<span>', { class: 'cart-line-unit-price' }).text(catalog.money(product.price) + ' each').appendTo($price);
        $row.append(product ? mark(product) : $('<span>', { class: 'resource-mark', 'aria-hidden': 'true' }).text('?'), $copy, $price).appendTo('#cart-items');
      }
      $('#cart-item-count').text(totalQuantity + (totalQuantity === 1 ? ' item' : ' items'));
      $('#summary-quantity').text(totalQuantity);
      $('#summary-subtotal, #summary-total').text(catalog.money(totalCents / 100));
      $('#summary-note').text(unavailable ? 'Totals exclude unavailable items. Remove them before preparing your cart.'
        : entries.length ? 'Review quantities above. Your selection is saved in this browser.' : 'Add a resource to get started.');
      updatePrepareState();
      if (focusId) document.getElementById(focusId)?.focus();
    }
    function renderProducts() {
      const results = catalog.search($('#cart-query').val(), $('#cart-category').val());
      $('#cart-product-list').empty();
      $('#browse-count').text(catalog.getAll().length + ' resources in the collection');
      $('#browse-message').text(results.length + (results.length === 1 ? ' resource found' : ' resources found'));
      $('#cart-no-results').toggleClass('d-none', results.length > 0);
      for (const product of results) {
        const $card = $('<li>', { class: 'resource-card' });
        const $cover = $('<div>', { class: 'resource-cover', 'data-category': product.category, 'aria-hidden': 'true' });
        $('<span>', { class: 'cover-initial' }).text(product.category.charAt(0)).appendTo($cover);
        $('<span>', { class: 'cover-category' }).text(product.category).appendTo($cover);
        const $copy = $('<div>', { class: 'resource-card-copy' });
        $('<p>', { class: 'resource-card-id' }).text(product.productId + ' / ' + product.category.toUpperCase()).appendTo($copy);
        $('<h3>').text(product.name).appendTo($copy);
        $('<p>', { class: 'resource-card-description' }).text(product.description).appendTo($copy);
        const $bottom = $('<div>', { class: 'resource-card-bottom' });
        const $price = $('<div>', { class: 'resource-card-price' }).text(catalog.money(product.price));
        $('<span>').text('per ' + product.unitOfMeasure.toLowerCase()).appendTo($price);
        const $add = $('<button>', {
          class: 'btn btn-outline-secondary', type: 'button', 'data-add-id': product.productId,
          'aria-label': 'Add ' + product.name + ' to cart'
        }).text('Add to cart +');
        $bottom.append($price, $add);
        $copy.append($bottom);
        $card.append($cover, $copy).appendTo('#cart-product-list');
      }
    }
    async function load() {
      ready = false;
      $('#cart-query, #cart-category, #cart-search-button, #cart-clear-filters, #prepare-cart, #clear-cart').prop('disabled', true);
      $('#retry-catalog').addClass('d-none');
      $('#browse-message').text('Loading products...');
      try {
        await catalog.load();
        ready = true;
        $('#cart-query, #cart-category, #cart-search-button, #cart-clear-filters').prop('disabled', false);
        renderCart();
        renderProducts();
      } catch (error) {
        $('#cart-loading').text('The collection could not be loaded. Use Reload collection to try again.');
        $('#browse-message').text(error.message);
        $('#retry-catalog').removeClass('d-none');
      }
    }
    for (const category of catalog.categories) $('<option>', { value: category }).text(category).appendTo('#cart-category');
    $('#cart-search-form').on('submit', function (event) { event.preventDefault(); if (ready) renderProducts(); });
    $('#cart-query').on('input', function () { if (ready) renderProducts(); });
    $('#cart-category').on('change', function () { if (ready) renderProducts(); });
    $('#cart-clear-filters').on('click', function () { $('#cart-query, #cart-category').val(''); renderProducts(); $('#cart-query').trigger('focus'); });
    $('#cart-product-list').on('click', '[data-add-id]', function () {
      try {
        if (hasDraft()) throw new Error('Update your pending quantity changes before adding another resource.');
        const product = catalog.getById($(this).attr('data-add-id'));
        if (!product) throw new Error('That product is no longer available.');
        const amount = cart.add(product.productId);
        renderCart();
        announce(product.name + ' added. Quantity in cart: ' + amount + '.');
      } catch (error) { announce(error.message, 'danger'); }
    });
    $('#cart-items').on('input', 'input[name="quantity"]', function () {
      invalidatePrepared();
      const $form = $(this).closest('form');
      $form.find('.quantity-draft-note').toggleClass('is-visible', this.value !== this.dataset.savedQuantity);
      this.classList.remove('is-invalid');
      this.setAttribute('aria-invalid', 'false');
      $form.find('.quantity-error').text('');
      updatePrepareState();
    });
    $('#cart-items').on('submit', '.cart-quantity-form', function (event) {
      event.preventDefault();
      const input = this.elements.quantity;
      const id = this.dataset.productId;
      try {
        cart.update(id, input.value, Number(input.dataset.savedQuantity));
        renderCart('quantity-' + id);
        announce('Quantity updated. Your cart total is now ' + $('#summary-total').text() + '.');
      } catch (error) {
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        $(this).find('.quantity-error').text(error.message);
        input.focus();
        announce(error.message, 'danger');
      }
    });
    $('#cart-items').on('click', '[data-remove-id]', function () {
      try {
        const id = $(this).attr('data-remove-id');
        const entry = cart.read().find((item) => item.productId === id);
        cart.remove(id);
        lastRemoved = entry;
        renderCart();
        announce('Resource removed from your cart.', 'info', true);
        $('#undo-remove').trigger('focus');
      } catch (error) { announce(error.message, 'danger'); }
    });
    $('#undo-remove').on('click', function () {
      if (!lastRemoved) return;
      try {
        cart.add(lastRemoved.productId, lastRemoved.quantity);
        const id = lastRemoved.productId;
        lastRemoved = null;
        renderCart('quantity-' + id);
        announce('Resource restored to your cart.');
      } catch (error) { announce(error.message, 'danger'); }
    });
    $('#clear-cart, #reset-cart').on('click', () => clearDialog.showModal());
    $('#keep-cart').on('click', () => clearDialog.close());
    $('#confirm-clear-cart').on('click', function () {
      try {
        cart.clear(); lastRemoved = null;
        clearDialog.close(); renderCart();
        announce('Your cart has been cleared.', 'info');
      } catch (error) { clearDialog.close(); storageError(error); }
    });
    $('#retry-cart').on('click', () => { if (ready) renderCart(); });
    $('#retry-catalog').on('click', load);
    $('#prepare-cart').on('click', async function () {
      if (!ready || preparing || hasDraft()) return;
      preparing = true;
      updatePrepareState();
      try {
        const stamp = JSON.stringify(cart.read());
        const document = cart.document(catalog);
        if (!document.items.length) throw new Error('Add a product before preparing the cart.');
        const response = await catalog.prepareCart(document);
        if (stamp !== JSON.stringify(cart.read()) || hasDraft()) throw new Error('Your cart changed while preparing. Apply your edits, then prepare it again.');
        renderCart();
        prepared = response;
        $('#cart-json').text(JSON.stringify(prepared, null, 2));
        $('#cart-preview-description').text(catalog.isShared()
          ? 'Validated through the project API using the current catalog prices. No order or payment was created.'
          : 'A JSON copy of this browser\'s cart. Start the Node server to validate and send it through the project API.');
        previewDialog.showModal();
        announce('Cart data prepared successfully.');
      } catch (error) { announce(error.message, 'danger'); }
      finally { preparing = false; updatePrepareState(); }
    });
    $('#close-cart-preview, #back-to-cart').on('click', () => previewDialog.close());
    $('#download-cart-json').on('click', function () {
      if (!prepared) return;
      const blob = new Blob([JSON.stringify(prepared, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'shopping-cart.json';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    window.addEventListener('storage', function (event) {
      if (event.key === cart.key) announce('Your cart changed in another tab. Finish any quantity edits, then refresh to see the latest cart.', 'info');
    });
    load();
  });
})(window.jQuery);
