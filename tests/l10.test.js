'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('../server');
const post = (changes = {}) => ({ requestId: randomUUID(), title: 'A neighborhood book club for everyone',
  author: 'Demo Contributor', category: 'Reading', summary: 'A friendly book club brings neighbors together through reading and conversation.',
  content: 'Our neighborhood book club meets once a month. Each reader brings a favorite passage and a question. We make time for everyone to share, even if they have not finished the book.', ...changes });
const billing = (changes = {}) => ({ requestId: randomUUID(), fullName: 'Demo Reader', email: 'demo@example.com',
  address: { line1: '123 Example Lane', line2: '', city: 'Sample City', region: 'PA', postalCode: '16801', country: 'United States' },
  payment: { cardNumber: '4242 4242 4242 4242', expiration: '12/40', securityCode: '123' },
  items: [{ productId: 'P101', quantity: 2 }, { productId: 'P102', quantity: 1 }], ...changes });
const returned = (orderId, changes = {}) => ({ requestId: randomUUID(), orderId, items: [{ productId: 'P101', quantity: 1 }],
  reason: 'Wrong resource selected', condition: 'Not accessed', notes: '', ...changes });
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-l10-'));
  const config = { dataFile: path.join(directory, 'members.json'), productDataFile: path.join(directory, 'products.json'),
    finalizationDataFile: path.join(directory, 'finalizations.json'), l10Directory: directory };
  let server, base;
  async function start() { server = createServer(config); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port; }
  async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await start();
  t.after(async () => { await stop(); fs.rmSync(directory, { recursive: true, force: true }); });
  async function send(method, url, data, headers = {}) {
    return fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: typeof data === 'string' ? data : JSON.stringify(data) }) });
  }
  return { directory, send, restart: async () => { await stop(); await start(); } };
}
test('submission create/list/filter and approve/reject persist; duplicate retries and stale reviews are protected', async t => {
  const app = await fixture(t), input = post();
  const response = await app.send('POST', '/api/submissions', input);
  assert.equal(response.status, 201); const record = await response.json();
  assert.match(record.id, /^POST-[A-F0-9]{8}$/); assert.equal(record.status, 'pending');
  assert.equal((await app.send('POST', '/api/submissions', input)).status, 200);
  assert.equal((await app.send('POST', '/api/submissions', { ...input, title: 'Changed post with a reused request' })).status, 409);
  assert.equal((await (await app.send('GET', '/api/submissions?status=pending')).json()).length, 1);
  const approved = await app.send('PATCH', '/api/submissions/' + record.id, { status: 'approved', expectedStatus: 'pending' });
  assert.equal(approved.status, 200); assert.equal((await approved.json()).status, 'approved');
  assert.equal((await app.send('PATCH', '/api/submissions/' + record.id, { status: 'rejected', expectedStatus: 'pending' })).status, 409);
  await app.restart();
  assert.equal((await (await app.send('GET', '/api/submissions/' + record.id)).json()).status, 'approved');
  const second = await (await app.send('POST', '/api/submissions', post())).json();
  assert.equal((await (await app.send('PATCH', '/api/submissions/' + second.id, { status: 'rejected', expectedStatus: 'pending' })).json()).status, 'rejected');
});
test('invalid fields, malformed JSON, wrong content types, oversized bodies and wrong methods never create a post', async t => {
  const app = await fixture(t);
  for (const changes of [{ title: 'x' }, { author: '' }, { category: 'invalid' }, { summary: '' }, { content: 'too short' }])
    assert.equal((await app.send('POST', '/api/submissions', post(changes))).status, 422);
  assert.equal((await app.send('POST', '/api/submissions', '{bad')).status, 400);
  assert.equal((await app.send('POST', '/api/submissions', '[]')).status, 400);
  assert.equal((await app.send('POST', '/api/submissions', post(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await app.send('POST', '/api/submissions', JSON.stringify({ content: 'x'.repeat(70000) }))).status, 413);
  assert.equal((await app.send('DELETE', '/api/submissions')).status, 405);
  assert.equal(fs.existsSync(path.join(app.directory, 'submissions.json')), false);
});
test('billing uses server prices, masks payment data, persists after restart and makes retries idempotent', async t => {
  const app = await fixture(t), input = billing({ total: 0, items: [{ productId: 'P101', quantity: 2, price: 0 }, { productId: 'P102', quantity: 1 }] });
  const response = await app.send('POST', '/api/billing', input); assert.equal(response.status, 201);
  const order = await response.json(); assert.equal(order.total, 17.97); assert.equal(order.shipping.amount, 0);
  assert.equal(order.items[0].name, 'Community Reading Guide'); assert.equal(order.payment.last4, '4242');
  const persisted = fs.readFileSync(path.join(app.directory, 'orders.json'), 'utf8');
  assert.doesNotMatch(persisted, /cardNumber|securityCode|4242 4242|4242424242424242/);
  assert.equal((await app.send('POST', '/api/billing', input)).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(app.directory, 'orders.json'))).length, 1);
  await app.restart(); const read = await (await app.send('GET', '/api/orders/' + order.id)).json();
  assert.equal(read.total, 17.97); assert.equal(read.items[0].availableQuantity, 2);
});
test('billing rejects invalid card details, contacts, quantities, missing products and stale totals', async t => {
  const app = await fixture(t);
  for (const changes of [{ email: 'bad' }, { fullName: '' }, { address: {} },
    { payment: { cardNumber: '1111111111111111', expiration: '01/20', securityCode: 'x' } },
    { payment: { cardNumber: '4242424242424242', expiration: '01/20', securityCode: '123' } },
    { items: [] }, { items: [{ productId: 'P101', quantity: 1.5 }] },
    { items: [{ productId: 'P101', quantity: 1 }, { productId: 'P101', quantity: 1 }] }])
    assert.equal((await app.send('POST', '/api/billing', billing(changes))).status, 422);
  assert.equal((await app.send('POST', '/api/billing', billing({ expectedTotalCents: 1 }))).status, 409);
  assert.equal((await app.send('POST', '/api/billing', billing({ items: [{ productId: 'P999', quantity: 1 }] }))).status, 409);
  assert.equal(fs.existsSync(path.join(app.directory, 'orders.json')), false);
});
test('returns use purchase-time prices and enforce remaining quantities, reasons and conditions', async t => {
  const app = await fixture(t), order = await (await app.send('POST', '/api/billing', billing())).json();
  const catalog = await (await app.send('GET', '/api/products')).json();
  await app.send('PUT', '/api/products/P101', { ...catalog.find(item => item.productId === 'P101'), price: 50 });
  const input = returned(order.id), response = await app.send('POST', '/api/returns', input); assert.equal(response.status, 201);
  const request = await response.json(); assert.equal(request.requestedAmount, 4.99); assert.equal(request.status, 'requested');
  assert.equal((await app.send('POST', '/api/returns', input)).status, 200);
  let read = await (await app.send('GET', '/api/orders/' + order.id)).json(); assert.equal(read.items[0].availableQuantity, 1);
  assert.equal((await app.send('POST', '/api/returns', returned(order.id, { items: [{ productId: 'P101', quantity: 2 }] }))).status, 409);
  assert.equal((await app.send('POST', '/api/returns', returned(order.id, { items: [{ productId: 'P105', quantity: 1 }] }))).status, 409);
  assert.equal((await app.send('POST', '/api/returns', returned(order.id, { reason: '' }))).status, 422);
  assert.equal((await app.send('POST', '/api/returns', returned(order.id, { condition: '' }))).status, 422);
  assert.equal((await app.send('POST', '/api/returns', returned('ORD-00000000'))).status, 404);
  await app.restart(); assert.equal((await (await app.send('GET', '/api/returns/' + request.id)).json()).requestedAmount, 4.99);
  read = await (await app.send('GET', '/api/orders/' + order.id)).json(); assert.equal(read.items[0].availableQuantity, 1);
});
test('concurrent identical submissions do not duplicate; concurrent returns cannot exceed purchased quantities', async t => {
  const app = await fixture(t), input = post();
  const posts = await Promise.all([app.send('POST', '/api/submissions', input), app.send('POST', '/api/submissions', input)]);
  assert.deepEqual(posts.map(response => response.status).sort(), [200, 201]);
  const order = await (await app.send('POST', '/api/billing', billing({ items: [{ productId: 'P101', quantity: 1 }] }))).json();
  const requests = await Promise.all([app.send('POST', '/api/returns', returned(order.id)), app.send('POST', '/api/returns', returned(order.id))]);
  assert.deepEqual(requests.map(response => response.status).sort(), [201, 409]);
});
test('corrupt storage is preserved instead of overwritten', async t => {
  const app = await fixture(t); fs.writeFileSync(path.join(app.directory, 'submissions.json'), '{broken');
  assert.equal((await app.send('POST', '/api/submissions', post())).status, 500);
  assert.equal(fs.readFileSync(path.join(app.directory, 'submissions.json'), 'utf8'), '{broken');
});
test('all workflow pages, dependencies and resource illustrations load', async t => {
  const app = await fixture(t);
  for (const file of ['submission.html', 'approval.html', 'billing.html', 'returns.html', 'css/l10.css', 'js/l10-app.js',
    'js/l10-validation.js', 'vendor/angular-1.8.3.min.js', 'images/resources/P101.svg', 'images/resources/default.svg'])
    assert.equal((await app.send('GET', '/' + file)).status, 200, file);
});
