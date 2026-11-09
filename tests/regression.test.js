'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { JSDOM } = require('jsdom');
const { createServer } = require('../server');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const members = [
  { id: 'member-a', fullName: 'Alex Reader', email: 'alex@example.com', age: 22, phone: '', address: '100 College Avenue' },
  { id: 'member-b', fullName: 'Blair Writer', email: 'blair@example.com', age: 24, phone: '', address: '200 College Avenue' }
];

async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the page.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function memberPage(t) {
  const dom = new JSDOM(read('public/signup.html'), { url: 'http://localhost/signup.html', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const document = window.document;
  const writes = [];
  window.fetch = (url, options = {}) => {
    if (!options.method) return Promise.resolve({ ok: true, json: async () => members });
    return new Promise((resolve, reject) => writes.push({ url, ...options, resolve, reject }));
  };
  window.eval(read('public/js/validation.js'));
  window.eval(read('public/js/signup.js'));
  await until(() => document.querySelectorAll('#members-body button').length === 2);
  return {
    document, writes,
    input(name, value) {
      const field = document.getElementById(name);
      field.value = value;
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    edit(index) { document.querySelectorAll('#members-body button')[index].click(); },
    submit() { document.getElementById('member-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); },
    async finish(ok = true) {
      writes[0].resolve({ ok, json: async () => ok ? members[0] : { message: 'Save failed for Alex.' } });
      await until(() => !document.getElementById('submit-button').disabled);
    }
  };
}

test('a delayed member save preserves another member draft after Cancel and Edit', async (t) => {
  const page = await memberPage(t);
  page.edit(0);
  page.input('fullName', 'Alex Updated');
  page.submit();
  assert.equal(page.writes[0].url, '/api/members/member-a');
  page.document.getElementById('cancel-button').click();
  page.edit(1);
  page.input('address', 'Blair unsaved address');
  await page.finish();
  assert.equal(page.document.getElementById('fullName').value, 'Blair Writer');
  assert.equal(page.document.getElementById('address').value, 'Blair unsaved address');
  assert.equal(page.document.getElementById('form-title').textContent, 'Edit member');
  assert.equal(page.document.getElementById('submit-button').textContent, 'Save changes');
  page.submit();
  assert.equal(page.writes[1].url, '/api/members/member-b');
  assert.equal(JSON.parse(page.writes[1].body).address, 'Blair unsaved address');
});

test('a delayed save error does not replace another member validation message', async (t) => {
  const page = await memberPage(t);
  page.edit(0);
  page.submit();
  page.edit(1);
  page.input('email', 'blair-draft@example.com');
  await page.finish(false);
  assert.equal(page.document.getElementById('email').value, 'blair-draft@example.com');
  assert.ok(page.document.getElementById('form-message').classList.contains('d-none'));
});

test('typing during a pending save keeps the newer draft', async (t) => {
  const page = await memberPage(t);
  page.edit(0);
  page.submit();
  page.input('fullName', 'Alex newer draft');
  await page.finish();
  assert.equal(page.document.getElementById('fullName').value, 'Alex newer draft');
  assert.equal(page.document.getElementById('submit-button').textContent, 'Save changes');
});

test('unchanged successful edits reset the form and show the update message', async (t) => {
  const page = await memberPage(t);
  page.edit(0);
  page.input('fullName', 'Alex Updated');
  page.submit();
  page.submit();
  assert.equal(page.writes.length, 1, 'duplicate submission must not send another write');
  await page.finish();
  assert.equal(page.document.getElementById('fullName').value, '');
  assert.equal(page.document.getElementById('form-message').textContent, 'Member updated successfully.');
  assert.equal(page.document.getElementById('submit-button').textContent, 'Register');
});

test('current save errors keep the draft and allow retry', async (t) => {
  const page = await memberPage(t);
  page.edit(0);
  page.input('fullName', 'Alex unsaved');
  page.submit();
  await page.finish(false);
  assert.equal(page.document.getElementById('fullName').value, 'Alex unsaved');
  assert.equal(page.document.getElementById('form-message').textContent, 'Save failed for Alex.');
  page.submit();
  assert.equal(page.writes.length, 2);
});

async function runningServer(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'community-hub-test-'));
  const server = createServer({ dataFile: path.join(directory, 'members.json'), productDataFile: path.join(directory, 'products.json') });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('member API supports registration, validation, duplicate checks and updates', async (t) => {
  const base = await runningServer(t);
  async function send(method, pathname, data) {
    return fetch(base + pathname, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }
  assert.deepEqual(await (await fetch(base + '/api/members')).json(), []);
  const created = await send('POST', '/api/members', members[0]);
  assert.equal(created.status, 201);
  const record = await created.json();
  assert.ok(record.id);
  assert.equal((await send('POST', '/api/members', members[0])).status, 409);
  assert.equal((await send('POST', '/api/members', { ...members[1], age: 'bad' })).status, 422);
  assert.equal((await send('PUT', '/api/members/' + record.id, { ...members[0], fullName: 'Alex Revised' })).status, 200);
  assert.equal((await (await fetch(base + '/api/members')).json())[0].fullName, 'Alex Revised');
  assert.equal((await send('PUT', '/api/members/missing', members[1])).status, 404);
});

test('static assets use image MIME types, text charset, and body-free HEAD responses', async (t) => {
  const base = await runningServer(t);
  const directory = fs.mkdtempSync(path.join(root, 'public', 'mime-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const folder = path.basename(directory);
  for (const [extension, type] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['webp', 'image/webp']]) {
    fs.writeFileSync(path.join(directory, 'test.' + extension), Buffer.from([0, 1, 2, 3]));
    const response = await fetch(`${base}/${folder}/test.${extension}`);
    assert.equal(response.headers.get('content-type'), type);
    assert.equal((await response.arrayBuffer()).byteLength, 4);
  }
  const image = await fetch(base + '/images/slow-reading-v2.svg');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/svg+xml');
  assert.ok((await image.arrayBuffer()).byteLength < 300000);
  assert.match((await fetch(base + '/data/products.json')).headers.get('content-type'), /^application\/json; charset=utf-8$/);
  const head = await fetch(base + '/images/slow-reading-v2.svg', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'image/svg+xml');
  assert.equal(await head.text(), '');
  for (const pathname of ['/', '/signup.html', '/products.html', '/vendor/bootstrap.min.css', '/vendor/jquery-3.7.1.min.js']) {
    assert.equal((await fetch(base + pathname)).status, 200, pathname);
  }
});

test('L7 catalog loads with real jQuery and supports search, validation, creation, updates and saved JSON', async (t) => {
  const base = await runningServer(t);
  const dom = await JSDOM.fromURL(base + '/products.html', { resources: 'usable', runScripts: 'dangerously' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const document = window.document;
  await until(() => document.getElementById('catalog-count').textContent === '5 resources');
  const catalog = window.ProductCatalog;
  assert.equal(window.jQuery.fn.jquery, '3.7.1');
  document.getElementById('search-query').value = 'p102';
  document.getElementById('search-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(document.querySelectorAll('#product-list li').length, 1);
  assert.equal(document.getElementById('productId').value, 'P102');
  const original = catalog.getById('P102');
  assert.equal(catalog.validate({ ...original, price: '-1' }).valid, false);
  assert.equal(catalog.validate({ ...original, price: '1.234' }).valid, false);
  const updated = await catalog.update('P102', { ...original, name: 'Updated magazine', price: '0' }, original);
  assert.equal(updated.price, 0);
  const created = await catalog.create({ ...original, productId: 'P106', name: 'New resource', price: '8.50' });
  assert.equal(created.price, 8.5);
  await assert.rejects(() => catalog.create(created), /already exists/);
  assert.equal(JSON.parse(catalog.toJSON()).length, 6);
  const saved = window.localStorage.getItem('community-hub.product-changes.v1');
  const restored = await JSDOM.fromURL(base + '/products.html', {
    resources: 'usable', runScripts: 'dangerously',
    beforeParse(otherWindow) { otherWindow.localStorage.setItem('community-hub.product-changes.v1', saved); }
  });
  t.after(() => restored.window.close());
  await until(() => restored.window.document.getElementById('catalog-count').textContent === '6 resources');
  assert.equal(restored.window.ProductCatalog.getById('P102').name, 'Updated magazine');
  assert.equal(restored.window.ProductCatalog.getById('P106').price, 8.5);
});
