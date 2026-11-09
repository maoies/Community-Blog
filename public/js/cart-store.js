/* Cart entries contain stable product IDs and quantities; prices come from the catalog. */
'use strict';
window.CommunityCart = (function () {
  const key = 'community-hub.cart.v1';
  const maxQuantity = 99;
  function quantity(value) {
    const text = String(value).trim();
    const number = Number(text);
    if (!/^\d+$/.test(text) || !Number.isInteger(number) || number < 1 || number > maxQuantity) {
      throw new Error('Enter a whole-number quantity from 1 to 99.');
    }
    return number;
  }
  function read() {
    let data;
    try {
      const text = window.localStorage.getItem(key);
      if (!text) return [];
      data = JSON.parse(text);
    } catch { throw new Error('Your saved cart could not be read. Try again, or reset the saved cart.'); }
    const ids = new Set();
    if (data?.version !== 1 || !Array.isArray(data.items)) throw new Error('Your saved cart has an unsupported format. Reset it to start again.');
    return data.items.map(function (item) {
      if (!/^P\d{3}$/.test(item?.productId) || ids.has(item.productId) || !Number.isInteger(item.quantity)) throw new Error('Your saved cart contains invalid items. Reset it to start again.');
      ids.add(item.productId);
      return { productId: item.productId, quantity: quantity(item.quantity) };
    });
  }
  function save(items) {
    try { window.localStorage.setItem(key, JSON.stringify({ version: 1, items })); }
    catch { throw new Error('The cart could not be saved. Allow site storage and try again. Your previous cart has been kept.'); }
    return items;
  }
  function add(productId, amount = 1) {
    if (!/^P\d{3}$/.test(productId)) throw new Error('Choose a valid product.');
    const items = read();
    const existing = items.find((item) => item.productId === productId);
    const next = quantity((existing?.quantity || 0) + quantity(amount));
    if (existing) existing.quantity = next;
    else items.push({ productId, quantity: next });
    save(items);
    return next;
  }
  function update(productId, value, expectedQuantity) {
    const next = quantity(value);
    const items = read();
    const item = items.find((entry) => entry.productId === productId);
    if (!item) throw new Error('This item is no longer in your cart. Refresh the page.');
    if (expectedQuantity !== undefined && item.quantity !== expectedQuantity) throw new Error('This quantity changed in another tab. Refresh before updating it.');
    item.quantity = next;
    save(items);
  }
  function remove(productId) { save(read().filter((item) => item.productId !== productId)); }
  function document(catalog) {
    let totalCents = 0;
    let totalQuantity = 0;
    const items = read().map(function (entry) {
      const product = catalog.getById(entry.productId);
      if (!product) throw new Error('Remove unavailable products before preparing your cart.');
      const cents = Math.round(product.price * 100) * entry.quantity;
      totalCents += cents;
      totalQuantity += entry.quantity;
      return { ...product, quantity: entry.quantity, lineSubtotal: cents / 100 };
    });
    return { currency: 'USD', items, totalQuantity, subtotal: totalCents / 100, total: totalCents / 100 };
  }
  return { key, maxQuantity, quantity, read, add, update, remove, clear: () => save([]), document };
})();
