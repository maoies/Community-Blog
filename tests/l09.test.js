'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('../server');

function options(overrides = {}) {
  return { requestId: randomUUID(), fullName: 'Alex Reader', email: 'alex@example.com',
    accessMethod: 'both', readingFormat: 'pdf', notificationFrequency: 'weekly',
    notes: 'I enjoy community stories.', consent: true,
    items: [{ productId: 'P101', quantity: 2 }, { productId: 'P102', quantity: 1 }], ...overrides };
}
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-l09-'));
  const files = { dataFile: path.join(directory, 'members.json'), productDataFile: path.join(directory, 'products.json'), finalizationDataFile: path.join(directory, 'finalizations.json') };
  let server;
  let base;
  async function start() {
    server = createServer(files); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await start();
  t.after(async () => {
    await stop();
    assert.equal(path.dirname(directory), os.tmpdir());
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { ...files,
    async restart() { await stop(); await start(); },
    send(method, route, data) { return fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }); }
  };
}

test('L09 validates JSON, saves a server-priced confirmation, reads it after restart, and makes retries idempotent', async (t) => {
  const app = await fixture(t);
  const input = options({ email: ' Alex@Example.com ', total: 0, items: [{ productId: 'P101', quantity: 2, price: 0, name: 'Forged title' }, { productId: 'P102', quantity: 1 }] });
  const response = await app.send('POST', '/api/finalizations', input);
  assert.equal(response.status, 201);
  const record = await response.json();
  assert.equal(response.headers.get('Location'), '/api/finalizations/' + record.id);
  assert.equal(record.options.email, 'alex@example.com');
  assert.equal(record.selection.items[0].name, 'Community Reading Guide');
  assert.equal(record.selection.total, 17.97);
  assert.equal(record.selection.totalQuantity, 3);
  assert.equal(record.status, 'confirmed');
  const stored = JSON.parse(fs.readFileSync(app.finalizationDataFile, 'utf8'));
  assert.equal(stored[0].id, record.id);
  assert.equal((await app.send('POST', '/api/finalizations', input)).status, 200);
  assert.equal((await app.send('POST', '/api/finalizations', { ...input, notes: 'Changed payload with reused key' })).status, 409);
  assert.equal(JSON.parse(fs.readFileSync(app.finalizationDataFile, 'utf8')).length, 1);
  await app.restart();
  const read = await app.send('GET', '/api/finalizations/' + record.id);
  assert.deepEqual(await read.json(), record);
  assert.equal((await app.send('GET', '/api/finalizations')).status, 200);
  assert.equal((await app.send('GET', '/api/finalizations/missing')).status, 404);
});

test('L09 rejects missing selections, tampered enums, invalid contact/quantities, absent consent and wrong HTTP methods', async (t) => {
  const app = await fixture(t);
  for (const [field, value] of [['fullName', ' '], ['email', 'not-an-email'], ['accessMethod', 'postal'], ['readingFormat', 'exe'], ['notificationFrequency', 'daily'], ['consent', 'true'], ['notes', 'a'.repeat(501)], ['items', []], ['items', [{ productId: 'P101', quantity: 1.5 }]], ['items', [{ productId: 'P101', quantity: 1 }, { productId: 'P101', quantity: 2 }]]]) {
    const response = await app.send('POST', '/api/finalizations', options({ [field]: value }));
    assert.equal(response.status, 422, field);
    assert.ok((await response.json()).errors[field], field);
  }
  assert.equal((await app.send('POST', '/api/finalizations', options({ requestId: '' }))).status, 422);
  assert.equal((await app.send('POST', '/api/finalizations', options({ items: [{ productId: 'P999', quantity: 1 }] }))).status, 409);
  assert.equal((await app.send('DELETE', '/api/finalizations')).status, 405);
  assert.equal(fs.existsSync(app.finalizationDataFile), false);
});

test('L09 uses the changed catalog at submission time and preserves corrupt JSON instead of overwriting it', async (t) => {
  const app = await fixture(t);
  const products = await (await app.send('GET', '/api/products')).json();
  await app.send('PUT', '/api/products/P101', { ...products[0], price: 10 });
  const response = await app.send('POST', '/api/finalizations', options());
  assert.equal((await response.json()).selection.total, 27.99);
  fs.writeFileSync(app.finalizationDataFile, '{broken');
  assert.equal((await app.send('POST', '/api/finalizations', options())).status, 500);
  assert.equal(fs.readFileSync(app.finalizationDataFile, 'utf8'), '{broken');
});

test('L09 simultaneous submissions do not lose records; identical retries produce one confirmation', async (t) => {
  const app = await fixture(t);
  const input = options();
  const responses = await Promise.all([app.send('POST', '/api/finalizations', input), app.send('POST', '/api/finalizations', input), app.send('POST', '/api/finalizations', options())]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201, 201]);
  assert.equal(JSON.parse(fs.readFileSync(app.finalizationDataFile, 'utf8')).length, 2);
});

test('L09 page, local React bundle and licenses load, and every page exposes the preferences navigation', async (t) => {
  const app = await fixture(t);
  for (const file of ['index.html', 'signup.html', 'products.html', 'cart.html', 'finalization.html']) {
    const response = await app.send('GET', '/' + file);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /href="finalization.html"/);
  }
  for (const file of ['js/finalization.bundle.js', 'js/finalization-validation.js', 'css/finalization.css', 'vendor/REACT-LICENSE.txt']) {
    const response = await app.send('GET', '/' + file);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 100);
  }
});
