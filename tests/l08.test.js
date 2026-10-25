'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { JSDOM } = require('jsdom');
const { createServer } = require('../server');
const root = path.join(__dirname, '..');
const publicRoot = path.join(root, 'public');
const seed = JSON.parse(fs.readFileSync(path.join(publicRoot, 'data/products.json')));

async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the page.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
async function server(t, { staticOnly = false, apiFailure = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'community-l08-'));
  const productFile = path.join(directory, 'products.json');
  const app = staticOnly ? http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) { res.writeHead(apiFailure ? 500 : 404, { 'Content-Type': 'application/json' }); res.end('{"message":"API unavailable."}'); return; }
    const file = path.resolve(publicRoot, '.' + pathname);
    if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  }) : createServer({ dataFile: path.join(directory, 'members.json'), productDataFile: productFile });
  const hits = [];
  app.prependListener('request', (req) => hits.push({ method: req.method, path: new URL(req.url, 'http://localhost').pathname }));
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(async () => { await new Promise((resolve) => app.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.address().port}`;
  return {
    base, hits, productFile,
    send(method, route, data) { return fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }); }
  };
}
async function page(t, base, pathname, storage = {}) {
  const dom = await JSDOM.fromURL(base + pathname, {
    resources: 'usable', runScripts: 'dangerously',
    beforeParse(window) {
      for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
      window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  return {
    window, document: window.document,
    input(id, value) { const input = window.document.getElementById(id); input.value = value; input.dispatchEvent(new window.Event('input', { bubbles: true })); },
    submit(form) { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); },
    click(selector) { window.document.querySelector(selector).click(); }
  };
}
async function cartPage(t, app, storage) {
  const result = await page(t, app.base, '/cart.html', storage);
  await until(() => result.document.querySelectorAll('[data-add-id]').length === 5);
  return result;
}
function cartOnly(t) {
  const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(fs.readFileSync(path.join(publicRoot, 'js/cart-store.js'), 'utf8'));
  return dom.window;
}

test('product REST endpoints perform GET, POST, PUT, DELETE and persist validated records', async (t) => {
  const app = await server(t);
  assert.equal((await (await app.send('GET', '/api/products')).json()).length, 5);
  const product = { ...seed[0], productId: 'P106', name: 'New classroom resource', price: 8.5 };
  assert.equal((await app.send('POST', '/api/products', product)).status, 201);
  assert.equal((await app.send('POST', '/api/products', product)).status, 409);
  assert.equal((await app.send('PUT', '/api/products/P106', { ...product, price: -1 })).status, 422);
  assert.equal((await app.send('PUT', '/api/products/P106', { ...product, productId: 'P107' })).status, 422);
  const updated = { ...product, name: 'Revised classroom resource', price: 0 };
  assert.equal((await app.send('PUT', '/api/products/P106', { ...updated, expectedProduct: product })).status, 200);
  assert.equal((await (await app.send('GET', '/api/products/P106')).json()).name, updated.name);
  assert.equal((await app.send('DELETE', '/api/products/P106', { expectedProduct: product })).status, 409);
  assert.equal((await app.send('DELETE', '/api/products/P106', { expectedProduct: updated })).status, 200);
  assert.equal((await app.send('GET', '/api/products/P106')).status, 404);
  assert.equal(JSON.parse(fs.readFileSync(app.productFile)).length, 5);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(publicRoot, 'data/products.json'))), seed, 'runtime writes must not change the seed catalog');
});

test('cart transport uses server prices and rejects invalid, duplicate, or unavailable entries', async (t) => {
  const app = await server(t);
  const response = await app.send('POST', '/api/cart/preview', { items: [{ productId: 'P101', quantity: 3, price: 0 }] });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.total, 14.97);
  assert.equal(data.items[0].price, 4.99);
  for (const quantity of [0, -1, 1.5, 100, '2']) assert.equal((await app.send('POST', '/api/cart/preview', { items: [{ productId: 'P101', quantity }] })).status, 422);
  assert.equal((await app.send('POST', '/api/cart/preview', { items: [] })).status, 422);
  assert.equal((await app.send('POST', '/api/cart/preview', { items: [{ productId: 'P999', quantity: 1 }] })).status, 409);
  assert.equal((await app.send('POST', '/api/cart/preview', { items: [{ productId: 'P101', quantity: 1 }, { productId: 'P101', quantity: 1 }] })).status, 422);
  assert.equal(fs.existsSync(app.productFile), false, 'preparing a cart must not create an order or alter products');
});

test('cart storage merges duplicate additions, validates quantities and computes cents exactly', (t) => {
  const window = cartOnly(t); const cart = window.CommunityCart;
  cart.add('P101'); cart.add('P101', 2); cart.add('P102');
  assert.equal(cart.read().length, 2);
  assert.equal(cart.read()[0].quantity, 3);
  for (const value of ['', '0', '-1', '2.5', '100', 'abc']) assert.throws(() => cart.update('P101', value), /quantity/);
  cart.update('P101', 2, 3);
  assert.throws(() => cart.update('P101', 5, 3), /another tab/);
  const document = cart.document({ getById: (id) => ({ ...seed[0], productId: id, price: id === 'P101' ? 0.1 : 0.2 }) });
  assert.equal(document.total, 0.4);
  assert.equal(document.items[0].lineSubtotal, 0.2);
  assert.equal(document.items[0].unitOfMeasure, 'Download');
  cart.update('P101', 99);
  assert.throws(() => cart.add('P101'), /quantity/);
  assert.equal(cart.read()[0].quantity, 99);
});

test('failed cart storage preserves prior entries and corrupt storage is not silently discarded', (t) => {
  const window = cartOnly(t); const cart = window.CommunityCart;
  cart.add('P101');
  const original = window.localStorage.getItem(cart.key);
  const set = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = () => { throw new Error('Storage is blocked.'); };
  assert.throws(() => cart.add('P102'), /could not be saved/);
  assert.equal(window.localStorage.getItem(cart.key), original);
  window.Storage.prototype.setItem = set;
  window.localStorage.setItem(cart.key, '{broken');
  assert.throws(() => cart.read(), /could not be read/);
  assert.equal(window.localStorage.getItem(cart.key), '{broken');
  cart.clear(); assert.equal(cart.read().length, 0);
});

test('cart UI searches, adds, validates, updates, removes, undoes and sends prepared JSON', async (t) => {
  const app = await server(t); const p = await cartPage(t, app);
  const d = p.document;
  assert.equal(d.getElementById('cart-empty').classList.contains('d-none'), false);
  p.input('cart-query', 'p101');
  assert.equal(d.querySelectorAll('[data-add-id]').length, 1);
  p.click('[data-add-id="P101"]'); p.click('[data-add-id="P101"]');
  assert.equal(d.getElementById('summary-total').textContent, '$9.98');
  p.input('quantity-P101', '4');
  assert.equal(d.getElementById('prepare-cart').disabled, true);
  p.input('quantity-P101', '2');
  assert.equal(d.getElementById('prepare-cart').disabled, false);
  assert.match(d.getElementById('summary-note').textContent, /Review quantities/);
  p.input('quantity-P101', '0');
  p.submit(d.querySelector('.cart-quantity-form'));
  assert.equal(d.getElementById('quantity-P101').getAttribute('aria-invalid'), 'true');
  assert.equal(d.getElementById('summary-total').textContent, '$9.98');
  p.input('quantity-P101', '3'); p.submit(d.querySelector('.cart-quantity-form'));
  assert.equal(d.getElementById('summary-total').textContent, '$14.97');
  p.click('[data-remove-id="P101"]');
  assert.equal(d.getElementById('cart-empty').classList.contains('d-none'), false);
  p.click('#undo-remove');
  assert.equal(d.getElementById('quantity-P101').value, '3');
  p.click('#prepare-cart');
  await until(() => d.getElementById('cart-preview-dialog').open);
  const payload = JSON.parse(d.getElementById('cart-json').textContent);
  assert.equal(payload.total, 14.97);
  assert.equal(payload.totalQuantity, 3);
  assert.equal(payload.items[0].productId, 'P101');
  assert.ok(app.hits.some((hit) => hit.method === 'POST' && hit.path === '/api/cart/preview'));
});

test('updating or removing one cart row preserves another row unsaved quantity', async (t) => {
  const app = await server(t); const p = await cartPage(t, app); const d = p.document;
  p.click('[data-add-id="P101"]'); p.click('[data-add-id="P102"]');
  p.input('quantity-P102', '5'); p.input('quantity-P101', '3');
  p.submit(d.querySelector('[data-product-id="P101"]'));
  assert.equal(d.getElementById('quantity-P102').value, '5');
  assert.equal(d.getElementById('quantity-P102').dataset.savedQuantity, '1');
  assert.equal(d.getElementById('prepare-cart').disabled, true);
  p.click('[data-remove-id="P101"]');
  assert.equal(d.getElementById('quantity-P102').value, '5');
  assert.equal(d.getElementById('summary-total').textContent, '$7.99');
});

test('deleted products stay removable in existing carts and cannot be sent to the API', async (t) => {
  const app = await server(t);
  await app.send('DELETE', '/api/products/P101', {});
  const p = await page(t, app.base, '/cart.html', { 'community-hub.cart.v1': JSON.stringify({ version: 1, items: [{ productId: 'P101', quantity: 2 }] }) });
  await until(() => p.document.querySelectorAll('[data-add-id]').length === 4);
  assert.match(p.document.querySelector('.cart-line').textContent, /Unavailable resource/);
  assert.equal(p.document.getElementById('prepare-cart').disabled, true);
  assert.equal(p.window.CommunityCart.read().length, 1);
  p.click('[data-remove-id="P101"]');
  assert.equal(p.window.CommunityCart.read().length, 0);
});

test('product editor validates, creates through AJAX, adds to cart and confirms deletion', async (t) => {
  const app = await server(t); const p = await page(t, app.base, '/products.html'); const d = p.document;
  await until(() => d.getElementById('catalog-count').textContent === '5 resources');
  p.click('#new-product');
  p.submit(d.getElementById('product-form'));
  assert.equal(d.getElementById('name').getAttribute('aria-invalid'), 'true');
  p.input('name', 'Fresh classroom resource');
  p.input('description', 'A new guide created during the storefront test.');
  p.input('category', 'Reading'); p.input('unitOfMeasure', 'Download'); p.input('price', '5.25');
  p.submit(d.getElementById('product-form'));
  await until(() => d.getElementById('catalog-count').textContent === '6 resources' && !d.getElementById('delete-product').disabled);
  assert.match(d.getElementById('edit-message').textContent, /Saved to the project server/);
  p.click('#add-product-to-cart');
  assert.equal(p.window.CommunityCart.read()[0].productId, 'P106');
  p.click('#delete-product');
  assert.equal(d.getElementById('delete-product-dialog').open, true);
  p.click('#cancel-delete-product');
  assert.ok(p.window.ProductCatalog.getById('P106'));
  p.click('#delete-product'); p.click('#confirm-delete-product');
  await until(() => d.getElementById('catalog-count').textContent === '5 resources');
  assert.equal(p.window.ProductCatalog.getById('P106'), null);
  assert.ok(app.hits.some((hit) => hit.method === 'POST' && hit.path === '/api/products'));
  assert.ok(app.hits.some((hit) => hit.method === 'DELETE' && hit.path === '/api/products/P106'));
});

test('shared catalog rejects stale updates from another browser without overwriting the record', async (t) => {
  const app = await server(t);
  const a = await page(t, app.base, '/products.html'); const b = await page(t, app.base, '/products.html');
  await until(() => a.document.getElementById('catalog-count').textContent === '5 resources' && b.document.getElementById('catalog-count').textContent === '5 resources');
  const original = b.window.ProductCatalog.getById('P101');
  await a.window.ProductCatalog.update('P101', { ...original, name: 'Updated by another browser' }, original);
  await assert.rejects(() => b.window.ProductCatalog.update('P101', { ...original, name: 'Stale overwrite' }, original), /another browser/);
  assert.equal((await (await app.send('GET', '/api/products/P101')).json()).name, 'Updated by another browser');
});

test('static hosting preserves local creation, edits, deletion and cart state after reopening', async (t) => {
  const app = await server(t, { staticOnly: true });
  const p = await page(t, app.base, '/products.html');
  await until(() => p.document.getElementById('catalog-count').textContent === '5 resources');
  const catalog = p.window.ProductCatalog;
  assert.equal(catalog.isShared(), false);
  await catalog.create({ ...seed[0], productId: 'P106', name: 'Static demo resource' });
  await catalog.update('P102', { ...seed[1], price: 1.25 }, catalog.getById('P102'));
  await catalog.remove('P101', catalog.getById('P101'));
  p.window.CommunityCart.add('P102', 2);
  const storage = Object.fromEntries([['community-hub.product-changes.v1', p.window.localStorage.getItem('community-hub.product-changes.v1')], ['community-hub.cart.v1', p.window.localStorage.getItem('community-hub.cart.v1')]]);
  const restored = await page(t, app.base, '/cart.html', storage);
  await until(() => restored.document.querySelectorAll('[data-add-id]').length === 5);
  assert.equal(restored.window.ProductCatalog.getById('P101'), null);
  assert.equal(restored.window.ProductCatalog.getById('P106').name, 'Static demo resource');
  assert.equal(restored.document.getElementById('summary-total').textContent, '$2.50');
});

test('server errors remain visible instead of silently switching to a different catalog', async (t) => {
  const app = await server(t, { staticOnly: true, apiFailure: true });
  const p = await page(t, app.base, '/products.html');
  await until(() => !p.document.getElementById('retry-load').classList.contains('d-none'));
  assert.match(p.document.getElementById('catalog-message').textContent, /Could not load/);
  assert.equal(app.hits.some((hit) => hit.path === '/data/products.json'), false);
});

test('all four pages link to the cart and all new page assets load', async (t) => {
  const app = await server(t);
  for (const name of ['index', 'signup', 'products', 'cart']) {
    const html = await (await fetch(app.base + '/' + name + '.html')).text();
    const document = new JSDOM(html).window.document;
    assert.ok(document.querySelector('nav a[href="cart.html"]'), name);
    for (const element of document.querySelectorAll('link[rel="stylesheet"],script[src]')) {
      const route = element.getAttribute('href') || element.getAttribute('src');
      assert.equal((await fetch(app.base + '/' + route)).status, 200, route);
    }
  }
});
