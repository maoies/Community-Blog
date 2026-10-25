/* Shared catalog: REST requests on the Node server; browser demo on static hosts. */
'use strict';
window.ProductCatalog = (function ($, rules) {
  const dataUrl = 'data/products.json';
  const apiUrl = 'api/products';
  const storageKey = 'community-hub.product-changes.v1';
  const copy = (value) => JSON.parse(JSON.stringify(value));
  let originals = [];
  let products = [];
  let loaded = false;
  let shared = false;
  let notice = '';

  function api(method, url, data) {
    return new Promise((resolve, reject) => {
      $.ajax({
        url, method, dataType: 'json', timeout: 10000, cache: false,
        ...(data === undefined ? {} : {
          contentType: 'application/json; charset=utf-8',
          data: JSON.stringify(data), processData: false
        })
      }).done(resolve).fail(function (xhr) {
        const error = new Error(xhr.responseJSON?.message || 'The product request could not be completed. Try again.');
        error.status = xhr.status;
        reject(error);
      });
    });
  }

  function normalize(list) {
    if (!Array.isArray(list)) throw new Error('Product data must be a JSON array.');
    const ids = new Set();
    return list.map(function (input) {
      const result = rules.validate(input);
      if (!result.valid || ids.has(result.product.productId)) throw new Error('Invalid product data.');
      ids.add(result.product.productId);
      return result.product;
    });
  }

  function readChanges() {
    const text = window.localStorage.getItem(storageKey);
    if (!text) return { changes: {}, deletedIds: [] };
    const saved = JSON.parse(text);
    if (saved?.version !== 1 || !Array.isArray(saved.products)) throw new Error('Invalid saved catalog.');
    const changes = Object.fromEntries(normalize(saved.products).map((product) => [product.productId, product]));
    const deletedIds = saved.deletedIds || [];
    if (!Array.isArray(deletedIds) || deletedIds.some((id) => !/^P\d{3}$/.test(id)) || new Set(deletedIds).size !== deletedIds.length) {
      throw new Error('Invalid deleted products.');
    }
    return { changes, deletedIds };
  }

  function combine(state) {
    const ids = new Set(originals.map((product) => product.productId));
    return [...originals.map((product) => state.changes[product.productId] || product),
      ...Object.values(state.changes).filter((product) => !ids.has(product.productId))]
      .filter((product) => !state.deletedIds.includes(product.productId)).map(copy);
  }

  function persist(state) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 1, products: Object.values(state.changes), deletedIds: state.deletedIds
      }));
    } catch {
      throw new Error('Changes could not be saved. Allow site storage, then try again. Your draft is still in the form.');
    }
    products = combine(state);
  }

  function stateForSave() {
    try { return readChanges(); }
    catch { return { changes: {}, deletedIds: [] }; }
  }

  async function load() {
    loaded = false;
    notice = '';
    try {
      // GET reads the shared product collection when the demonstration API is running.
      products = normalize(await api('GET', apiUrl));
      originals = copy(products);
      shared = true;
      try {
        if (window.localStorage.getItem(storageKey)) notice = 'The project server supplies this shared catalog. Older browser-only edits remain stored in this browser.';
      } catch { /* A shared catalog does not require browser product storage. */ }
    } catch (error) {
      // Only an absent endpoint selects static-demo mode. Server/network failures stay visible.
      if (![404, 405].includes(error.status)) throw error;
      originals = normalize(await $.getJSON(dataUrl));
      shared = false;
      let state = { changes: {}, deletedIds: [] };
      try { state = readChanges(); }
      catch { notice = 'Saved changes could not be read. Showing the sample catalog. Saving replaces unreadable saved changes.'; }
      products = combine(state);
    }
    loaded = true;
    return getAll();
  }

  function getAll() {
    if (!loaded) throw new Error('Load the catalog first.');
    return copy(products);
  }
  const getById = (id) => getAll().find((product) => product.productId === id) || null;
  function search(query = '', category = '') {
    const term = String(query).trim().toLowerCase();
    return getAll().filter((product) => (!category || product.category === category) &&
      (!term || [product.productId, product.name, product.description].some((value) => value.toLowerCase().includes(term))));
  }
  function validate(input, { creating = false } = {}) {
    const result = rules.validate(input);
    if (creating && loaded && getById(result.product.productId)) {
      result.errors.productId = 'This product ID already exists. Choose a different ID.';
      result.valid = false;
    }
    return result;
  }
  function nextId() {
    const used = new Set([...originals, ...getAll()].map((product) => product.productId));
    for (const [start, end] of [[101, 999], [1, 100]]) {
      for (let number = start; number <= end; number++) {
        const id = 'P' + String(number).padStart(3, '0');
        if (!used.has(id)) return id;
      }
    }
    return '';
  }
  function assertExpected(latest, expected) {
    if (!latest || (expected && JSON.stringify(latest) !== JSON.stringify(expected))) {
      throw new Error('This product changed or was removed in another tab. Reload the catalog before saving.');
    }
  }
  async function create(input) {
    if (!loaded) throw new Error('Load the catalog first.');
    const result = validate(input, { creating: true });
    if (!result.valid) throw new Error(Object.values(result.errors)[0]);
    if (shared) {
      // POST creates a new product from the validated form JSON.
      const product = (await api('POST', apiUrl, result.product));
      products.push(...normalize([product]));
      return copy(product);
    }
    const state = stateForSave();
    if (combine(state).some((product) => product.productId === result.product.productId)) throw new Error('This product ID already exists.');
    state.deletedIds = state.deletedIds.filter((id) => id !== result.product.productId);
    state.changes[result.product.productId] = result.product;
    persist(state);
    return copy(result.product);
  }
  async function update(id, input, expectedProduct) {
    if (!loaded || !getById(id)) throw new Error('Choose a product before saving.');
    const result = validate({ ...input, productId: id });
    if (!result.valid) throw new Error(Object.values(result.errors)[0]);
    if (shared) {
      // PUT updates the product; the snapshot detects conflicting edits.
      const product = (await api('PUT', apiUrl + '/' + encodeURIComponent(id), { ...result.product, expectedProduct }));
      normalize([product]);
      products = products.map((item) => item.productId === id ? product : item);
      return copy(product);
    }
    const state = stateForSave();
    assertExpected(combine(state).find((product) => product.productId === id), expectedProduct);
    state.changes[id] = result.product;
    persist(state);
    return copy(result.product);
  }
  async function remove(id, expectedProduct) {
    if (!loaded || !getById(id)) throw new Error('Choose a product before deleting.');
    if (shared) {
      // DELETE removes a product only after the page confirmation.
      await api('DELETE', apiUrl + '/' + encodeURIComponent(id), { expectedProduct });
      products = products.filter((product) => product.productId !== id);
      return;
    }
    const state = stateForSave();
    assertExpected(combine(state).find((product) => product.productId === id), expectedProduct);
    delete state.changes[id];
    if (!state.deletedIds.includes(id)) state.deletedIds.push(id);
    persist(state);
  }
  async function prepareCart(document) {
    if (!shared) return copy(document);
    // The demo endpoint validates JSON transport without creating an order or payment.
    const preview = await api('POST', 'api/cart/preview', {
      items: document.items.map(({ productId, quantity }) => ({ productId, quantity }))
    });
    const checked = normalize(preview.items);
    products = products.map((product) => checked.find((item) => item.productId === product.productId) || product);
    return preview;
  }
  return {
    load, getAll, getById, search, validate, nextId, create, update, remove, prepareCart,
    categories: [...rules.categories], units: [...rules.units],
    isShared: () => shared, getNotice: () => notice,
    money: (price) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price),
    toJSON: () => JSON.stringify(getAll(), null, 2) + '\n'
  };
})(window.jQuery, window.ProductValidation);
