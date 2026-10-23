/* Shared catalog for Product Details and the future L8 cart. Requires full jQuery. */
'use strict';
window.ProductCatalog = (function ($) {
  const dataUrl = 'data/products.json';
  const storageKey = 'community-hub.product-changes.v1';
  const categories = ['Reading', 'Magazine', 'Photography', 'Community'];
  const units = ['Download', 'Issue', 'Bundle'];
  let originals = [];
  let products = [];
  let loaded = false;
  let notice = '';
  const copy = (value) => JSON.parse(JSON.stringify(value));

  function validate(input, { creating = false } = {}) {
    const errors = {};
    const product = {};
    for (const key of ['productId', 'name', 'description', 'category', 'unitOfMeasure']) {
      product[key] = String(input?.[key] ?? '').trim();
    }
    if (!/^P\d{3}$/.test(product.productId)) errors.productId = 'Use an ID like P106 (P and three digits).';
    else if (creating && loaded && getById(product.productId)) errors.productId = 'This product ID already exists. Choose a different ID.';
    if (!product.name || product.name.length > 80) errors.name = 'Enter a product name (1-80 characters).';
    if (!product.description || product.description.length > 500) {
      errors.description = 'Enter a description (1-500 characters).';
    }
    if (!categories.includes(product.category)) errors.category = 'Choose a category.';
    if (!units.includes(product.unitOfMeasure)) errors.unitOfMeasure = 'Choose a unit of measure.';
    const priceText = String(input?.price ?? '').trim();
    const price = Number(priceText);
    if (priceText === '') errors.price = 'Price is required.';
    else if (!Number.isFinite(price)) errors.price = 'Enter a valid price.';
    else if (price < 0) errors.price = 'Price cannot be negative.';
    else if (price > 99999.99) errors.price = 'Price cannot exceed $99,999.99.';
    else if (!/^\d+(\.\d{1,2})?$/.test(priceText)) errors.price = 'Use a number with up to two decimal places.';
    product.price = price;
    return { product, errors, valid: Object.keys(errors).length === 0 };
  }

  function readChanges() {
    const text = window.localStorage.getItem(storageKey);
    if (!text) return {};
    const saved = JSON.parse(text);
    if (saved?.version !== 1 || !Array.isArray(saved.products)) throw new Error('Invalid saved catalog.');
    const changes = {};
    for (const input of saved.products) {
      const result = validate(input);
      if (!result.valid || changes[result.product.productId]) throw new Error('Invalid saved product.');
      changes[result.product.productId] = result.product;
    }
    return changes;
  }

  function combine(changes) {
    const originalIds = new Set(originals.map((product) => product.productId));
    return [
      ...originals.map((product) => copy(changes[product.productId] || product)),
      ...Object.values(changes).filter((product) => !originalIds.has(product.productId)).map(copy)
    ];
  }

  function load() {
    loaded = false;
    return $.getJSON(dataUrl).then(function (data) {
      if (!Array.isArray(data)) throw new Error('Product data must be a JSON array.');
      const ids = new Set();
      originals = data.map(function (input) {
        const result = validate(input);
        if (!result.valid || ids.has(result.product.productId)) throw new Error('Invalid product data.');
        ids.add(result.product.productId);
        return result.product;
      });
      let changes = {};
      notice = '';
      try { changes = readChanges(); }
      catch {
        notice = 'Saved changes could not be read. Showing the original catalog. Saving will replace unreadable saved changes.';
      }
      products = combine(changes);
      loaded = true;
      return getAll();
    });
  }

  function getAll() {
    if (!loaded) throw new Error('Load the catalog first.');
    return copy(products);
  }

  function getById(id) {
    return getAll().find((product) => product.productId === id) || null;
  }

  function search(query = '', category = '') {
    const term = query.trim().toLowerCase();
    return getAll().filter((product) =>
      (!category || product.category === category) &&
      (!term || product.productId.toLowerCase().includes(term) || product.name.toLowerCase().includes(term))
    );
  }

  function persist(changes) {
    // Persist first: a failed save must leave the displayed catalog unchanged.
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, products: Object.values(changes) }));
    } catch {
      throw new Error('Changes could not be saved. Allow site storage in this browser, then try again. Your edits are still in the form.');
    }
    products = combine(changes);
  }

  function create(input) {
    if (!loaded) throw new Error('Load the catalog first.');
    const result = validate(input, { creating: true });
    if (!result.valid) throw new Error(Object.values(result.errors)[0]);
    let changes;
    try { changes = readChanges(); }
    catch { changes = {}; }
    if (combine(changes).some((product) => product.productId === result.product.productId)) {
      throw new Error('This product ID already exists. Choose a different ID.');
    }
    changes[result.product.productId] = result.product;
    persist(changes);
    return copy(result.product);
  }

  function nextId() {
    const used = new Set(getAll().map((product) => product.productId));
    for (const [start, end] of [[101, 999], [1, 100]]) {
      for (let number = start; number <= end; number++) {
        const id = 'P' + String(number).padStart(3, '0');
        if (!used.has(id)) return id;
      }
    }
    return '';
  }

  function update(id, input, expectedProduct) {
    if (!loaded || !getById(id)) throw new Error('Choose a product before saving.');
    const result = validate({ ...input, productId: id });
    if (!result.valid) throw new Error('Please check the highlighted fields.');
    let changes;
    try { changes = readChanges(); }
    catch { changes = {}; }
    const latest = combine(changes).find((product) => product.productId === id);
    if (expectedProduct && JSON.stringify(latest) !== JSON.stringify(expectedProduct)) {
      throw new Error('This product changed in another tab. Reload the page to review the latest version before saving.');
    }
    changes[id] = result.product;
    persist(changes);
    return copy(result.product);
  }

  const money = (price) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  return {
    load, getAll, getById, search, create, nextId, update, validate, money,
    categories: [...categories], units: [...units],
    getNotice: () => notice,
    toJSON: () => JSON.stringify(getAll(), null, 2) + '\n'
  };
})(window.jQuery);
