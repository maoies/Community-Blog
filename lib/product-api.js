'use strict';
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../public/js/product-validation');

function createProductHandler({ dataFile, seedFile }) {
  function reply(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
    return true;
  }
  function read() {
    const source = fs.existsSync(dataFile) ? dataFile : seedFile;
    const data = JSON.parse(fs.readFileSync(source, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Invalid product collection.');
    const ids = new Set();
    return data.map(function (input) {
      const result = rules.validate(input);
      if (!result.valid || ids.has(result.product.productId)) throw new Error('Invalid product record.');
      ids.add(result.product.productId);
      return result.product;
    });
  }
  function write(products) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile + '.tmp', JSON.stringify(products, null, 2) + '\n');
    fs.renameSync(dataFile + '.tmp', dataFile);
  }
  async function body(req) {
    let text = '';
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 65536) {
        const error = new Error('Request is too large.');
        error.status = 413;
        throw error;
      }
    }
    try { return text ? JSON.parse(text) : {}; }
    catch {
      const error = new Error('Invalid JSON.');
      error.status = 400;
      throw error;
    }
  }
  return async function handle(req, res, pathname) {
    const collection = pathname === '/api/products';
    const match = pathname.match(/^\/api\/products\/(P\d{3})$/);
    const preview = pathname === '/api/cart/preview';
    if (!collection && !match && !preview) return false;
    try {
      if (preview) {
        if (req.method !== 'POST') return reply(res, 405, { message: 'Use POST to prepare cart data.' });
        const input = await body(req);
        if (!Array.isArray(input?.items) || !input.items.length || input.items.length > 999) return reply(res, 422, { message: 'Add at least one valid product before preparing the cart.' });
        const products = read();
        const ids = new Set();
        let totalCents = 0;
        let totalQuantity = 0;
        const items = [];
        for (const entry of input.items) {
          if (!/^P\d{3}$/.test(entry?.productId) || ids.has(entry.productId) || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99) {
            return reply(res, 422, { message: 'Each cart item needs a unique product ID and a whole-number quantity from 1 to 99.' });
          }
          ids.add(entry.productId);
          const product = products.find((item) => item.productId === entry.productId);
          if (!product) return reply(res, 409, { message: 'A cart product is no longer available. Refresh the cart and remove it.' });
          const cents = Math.round(product.price * 100) * entry.quantity;
          totalCents += cents;
          totalQuantity += entry.quantity;
          items.push({ ...product, quantity: entry.quantity, lineSubtotal: cents / 100 });
        }
        return reply(res, 200, { currency: 'USD', items, totalQuantity, subtotal: totalCents / 100, total: totalCents / 100 });
      }
      if (req.method === 'GET') {
        const products = read();
        if (collection) return reply(res, 200, products);
        const product = products.find((item) => item.productId === match[1]);
        return product ? reply(res, 200, product) : reply(res, 404, { message: 'Product not found.' });
      }
      if ((collection && req.method !== 'POST') || (match && !['PUT', 'DELETE'].includes(req.method))) {
        return reply(res, 405, { message: 'This HTTP method is not supported for that product endpoint.' });
      }
      const input = await body(req);
      const products = read();
      const index = match ? products.findIndex((item) => item.productId === match[1]) : -1;
      if (match && index === -1) return reply(res, 404, { message: 'Product not found. Refresh the catalog.' });
      if (match && input?.expectedProduct !== undefined) {
        const expected = rules.validate(input.expectedProduct);
        if (!expected.valid || JSON.stringify(expected.product) !== JSON.stringify(products[index])) {
          return reply(res, 409, { message: 'This product changed in another browser. Reload the catalog before saving or deleting.' });
        }
      }
      if (req.method === 'DELETE') {
        products.splice(index, 1);
        write(products);
        return reply(res, 200, { productId: match[1], deleted: true });
      }
      const result = rules.validate(input);
      if (!result.valid) return reply(res, 422, { message: 'Please check the product fields.', errors: result.errors });
      if (match && result.product.productId !== match[1]) return reply(res, 422, { message: 'A saved product ID cannot be changed.' });
      if (collection && products.some((product) => product.productId === result.product.productId)) return reply(res, 409, { message: 'This product ID already exists. Choose a different ID.' });
      if (match) products[index] = result.product;
      else products.push(result.product);
      write(products);
      return reply(res, match ? 200 : 201, result.product);
    } catch (error) {
      if (error.status) return reply(res, error.status, { message: error.message });
      throw error;
    }
  };
}
module.exports = { createProductHandler };
