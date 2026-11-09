'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const rules = require('../public/js/l10-validation');
const productRules = require('../public/js/product-validation');

function createWorkflowHandler({ dataDirectory, productDataFile, seedFile }) {
  const file = name => path.join(dataDirectory, name + '.json');
  function read(name) {
    const records = fs.existsSync(file(name)) ? JSON.parse(fs.readFileSync(file(name), 'utf8')) : [];
    if (!Array.isArray(records)) throw new Error('Invalid ' + name + ' collection.');
    return records;
  }
  function save(name, records) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporary = file(name) + '.' + randomUUID() + '.tmp';
    try { fs.writeFileSync(temporary, JSON.stringify(records, null, 2) + '\n'); fs.renameSync(temporary, file(name)); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  function reply(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data)); return true;
  }
  function id(prefix, records) {
    let value;
    do { value = prefix + '-' + randomUUID().slice(0, 8).toUpperCase(); } while (records.some(item => item.id === value));
    return value;
  }
  async function body(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''))
      throw Object.assign(new Error('Send application/json.'), { status: 415 });
    const chunks = []; let size = 0;
    // Drain oversized requests without retaining them or destroying the socket before replying.
    for await (const chunk of req) { size += chunk.length; if (size <= 65536) chunks.push(chunk); }
    if (size > 65536) throw Object.assign(new Error('The submitted document is too large.'), { status: 413 });
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
      return value;
    } catch { throw Object.assign(new Error('Send a valid JSON object.'), { status: 400 }); }
  }
  function findRetry(records, input, document) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId || ''))
      throw Object.assign(new Error('A valid requestId is required. Reload and try again.'), { status: 422 });
    const previous = records.find(record => record.requestId === input.requestId);
    if (previous && JSON.stringify(previous.document) !== JSON.stringify(document))
      throw Object.assign(new Error('This request ID was already used for different details. Start a new submission.'), { status: 409 });
    return previous;
  }
  function catalogItems(selections) {
    const catalog = JSON.parse(fs.readFileSync(fs.existsSync(productDataFile) ? productDataFile : seedFile, 'utf8'));
    if (!Array.isArray(catalog)) throw new Error('Invalid product collection.');
    return selections.map(selection => {
      const product = catalog.find(item => item.productId === selection.productId);
      if (!product) throw Object.assign(new Error('A selected resource is unavailable. Reload your cart.'), { status: 409 });
      const checked = productRules.validate(product);
      if (!checked.valid) throw new Error('Invalid product record.');
      const p = checked.product;
      return { ...p, quantity: selection.quantity, lineSubtotal: Math.round(p.price * 100) * selection.quantity / 100 };
    });
  }
  function returnable(order, requests) {
    return order.items.map(item => ({ ...item, availableQuantity: item.quantity - requests
      .filter(request => request.orderId === order.id)
      .reduce((sum, request) => sum + (request.items.find(entry => entry.productId === item.productId)?.quantity || 0), 0) }));
  }
  return async function handle(req, res, pathname) {
    const submissionItem = pathname.match(/^\/api\/submissions\/([\w-]+)$/);
    const orderItem = pathname.match(/^\/api\/orders\/([\w-]+)$/);
    const returnItem = pathname.match(/^\/api\/returns\/([\w-]+)$/);
    const route = pathname === '/api/submissions' ? 'submissions' : pathname === '/api/billing' ? 'orders' : pathname === '/api/returns' ? 'returns' : null;
    if (!route && !submissionItem && !orderItem && !returnItem) return false;
    try {
      if (req.method === 'GET' && (route === 'submissions' || submissionItem || orderItem || returnItem)) {
        const name = route || (submissionItem ? 'submissions' : orderItem ? 'orders' : 'returns'), records = read(name);
        if (route === 'submissions') {
          const status = new URL(req.url, 'http://localhost').searchParams.get('status');
          if (status && !['pending', 'approved', 'rejected'].includes(status)) return reply(res, 422, { message: 'Choose a valid review status.' });
          return reply(res, 200, status ? records.filter(record => record.status === status) : records);
        }
        const match = submissionItem || orderItem || returnItem, record = records.find(item => item.id === match[1]);
        if (!record) return reply(res, 404, { message: name === 'orders' ? 'Order not found. Check your confirmation number.' : 'Record not found.' });
        return reply(res, 200, orderItem ? { ...record, items: returnable(record, read('returns')) } : record);
      }
      if (submissionItem && req.method === 'PATCH') {
        const input = await body(req), records = read('submissions'), record = records.find(item => item.id === submissionItem[1]);
        if (!record) return reply(res, 404, { message: 'Post not found.' });
        if (!['approved', 'rejected'].includes(input.status) || !['pending', 'approved', 'rejected'].includes(input.expectedStatus))
          return reply(res, 422, { message: 'Provide an approval decision and the current expectedStatus.' });
        if (record.status !== input.expectedStatus) return reply(res, 409, { message: 'Another reviewer changed this post. Reload the queue.' });
        record.status = input.status; record.reviewedAt = new Date().toISOString(); save('submissions', records);
        return reply(res, 200, record);
      }
      if (!route || req.method !== 'POST') {
        res.setHeader('Allow', submissionItem ? 'GET, PATCH' : route === 'submissions' ? 'GET, POST' : orderItem || returnItem ? 'GET' : 'POST');
        return reply(res, 405, { message: 'This HTTP method is not supported for this endpoint.' });
      }
      const input = await body(req);
      const checked = route === 'submissions' ? rules.submission(input) : route === 'orders' ? rules.billing(input) : rules.returns(input);
      if (!checked.valid) return reply(res, 422, { message: 'Please check the highlighted fields.', errors: checked.errors });
      const records = read(route), document = checked.document, retry = findRetry(records, input, document);
      if (retry) return reply(res, 200, retry);
      const common = { schemaVersion: 1, requestId: input.requestId, createdAt: new Date().toISOString(), document };
      let record;
      if (route === 'submissions') record = { ...common, id: id('POST', records), ...document, status: 'pending' };
      else if (route === 'orders') {
        const items = catalogItems(document.items);
        const subtotal = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
        if (input.expectedTotalCents !== undefined && input.expectedTotalCents !== Math.round(subtotal * 100))
          return reply(res, 409, { message: 'Catalog prices changed. Reload the summary before submitting.', errors: { items: 'Reload the summary to review current prices.' } });
        record = { ...common, id: id('ORD', records), fullName: document.fullName, email: document.email,
          address: document.address, payment: document.payment, currency: 'USD', items, subtotal,
          shipping: { method: 'Digital delivery', amount: 0 }, total: subtotal, status: 'demo_confirmed' };
      } else {
        const order = read('orders').find(item => item.id === document.orderId);
        if (!order) return reply(res, 404, { message: 'Order not found. Check your confirmation number.', errors: { orderId: 'Enter an existing demonstration order number.' } });
        const available = returnable(order, records), items = [];
        for (const selection of document.items) {
          const item = available.find(entry => entry.productId === selection.productId);
          if (!item || selection.quantity > item.availableQuantity)
            return reply(res, 409, { message: 'A return quantity exceeds the remaining purchased amount. Reload the order.', errors: { items: 'Select only quantities still available for return.' } });
          const { availableQuantity, ...snapshot } = item;
          items.push({ ...snapshot, quantity: selection.quantity, lineSubtotal: Math.round(item.price * 100) * selection.quantity / 100 });
        }
        const requestedAmount = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
        record = { ...common, id: id('RET', records), orderId: order.id, items, reason: document.reason,
          condition: document.condition, notes: document.notes, currency: 'USD', requestedAmount, status: 'requested' };
      }
      records.push(record); save(route, records);
      res.setHeader('Location', '/api/' + route + '/' + record.id);
      return reply(res, 201, record);
    } catch (error) {
      if (!error.status) console.error('Workflow service: ' + error.message);
      return reply(res, error.status || 500, { message: error.status ? error.message : 'The request could not be completed. Your form has been kept; please try again.' });
    }
  };
}
module.exports = { createWorkflowHandler };
