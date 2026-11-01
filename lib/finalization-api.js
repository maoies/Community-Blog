'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const rules = require('../public/js/finalization-validation');
const productRules = require('../public/js/product-validation');

function createFinalizationHandler({ dataFile, productDataFile, seedFile }) {
  function reply(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
    return true;
  }
  function read() {
    const records = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : [];
    if (!Array.isArray(records)) throw new Error('Invalid finalization collection.');
    return records;
  }
  return async function handle(req, res, pathname) {
    const collection = pathname === '/api/finalizations';
    const item = pathname.match(/^\/api\/finalizations\/([\w-]+)$/);
    if (!collection && !item) return false;
    try {
      if (req.method === 'GET') {
        const records = read();
        if (collection) return reply(res, 200, records);
        const record = records.find((entry) => entry.id === item[1]);
        return record ? reply(res, 200, record) : reply(res, 404, { message: 'Confirmation not found.' });
      }
      if (!collection || req.method !== 'POST') return reply(res, 405, { message: 'Use GET to read or POST to submit finalization options.' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 65536) return reply(res, 413, { message: 'The submitted document is too large.' });
      }
      let input;
      try { input = JSON.parse(body); }
      catch { return reply(res, 400, { message: 'Send a valid JSON document.' }); }
      const result = rules.validate(input);
      if (!result.valid) return reply(res, 422, { message: 'Please check the highlighted options.', errors: result.errors });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId || ''))
        return reply(res, 422, { message: 'A valid requestId is required. Reload the page and try again.' });
      const records = read();
      // A retry of the same document returns the existing confirmation, without a second write.
      const previous = records.find((entry) => entry.requestId === input.requestId);
      if (previous) {
        if (JSON.stringify(previous.options) !== JSON.stringify(result.document)) return reply(res, 409, { message: 'This request ID was already used for different options.' });
        return reply(res, 200, previous);
      }
      const catalogFile = fs.existsSync(productDataFile) ? productDataFile : seedFile;
      const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
      if (!Array.isArray(catalog)) throw new Error('Invalid product collection.');
      let totalCents = 0;
      const items = [];
      for (const entry of result.document.items) {
        const raw = catalog.find((product) => product.productId === entry.productId);
        if (!raw) return reply(res, 409, { message: 'A selected resource is no longer available. Reload resources and review your selection.', errors: { items: 'A selected resource was removed. Reload resources before submitting.' } });
        const checked = productRules.validate(raw);
        if (!checked.valid) throw new Error('Invalid product record.');
        const cents = Math.round(checked.product.price * 100) * entry.quantity;
        totalCents += cents;
        items.push({ ...checked.product, quantity: entry.quantity, lineSubtotal: cents / 100 });
      }
      const record = {
        id: randomUUID(), requestId: input.requestId, schemaVersion: 1,
        status: 'confirmed', createdAt: new Date().toISOString(),
        options: result.document,
        selection: { currency: 'USD', items, totalQuantity: items.reduce((sum, entry) => sum + entry.quantity, 0), total: totalCents / 100 }
      };
      records.push(record);
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile + '.tmp', JSON.stringify(records, null, 2) + '\n');
      fs.renameSync(dataFile + '.tmp', dataFile);
      res.setHeader('Location', '/api/finalizations/' + record.id);
      return reply(res, 201, record);
    } catch (error) {
      console.error(error.message);
      return reply(res, 500, { message: 'Your options could not be saved. Your form is still here; please try again.' });
    }
  };
}
module.exports = { createFinalizationHandler };
