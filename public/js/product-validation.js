/* Shared product rules for the browser and the demonstration REST API. */
(function (root) {
  'use strict';
  const categories = ['Reading', 'Magazine', 'Photography', 'Community'];
  const units = ['Download', 'Issue', 'Bundle'];
  function validate(input) {
    const product = {};
    const errors = {};
    for (const key of ['productId', 'name', 'description', 'category', 'unitOfMeasure']) {
      product[key] = typeof input?.[key] === 'string' ? input[key].trim() : '';
    }
    if (!/^P\d{3}$/.test(product.productId)) errors.productId = 'Use an ID like P106 (P and three digits).';
    if (!product.name || product.name.length > 80) errors.name = 'Enter a product name (1-80 characters).';
    if (!product.description || product.description.length > 500) errors.description = 'Enter a description (1-500 characters).';
    if (!categories.includes(product.category)) errors.category = 'Choose a category.';
    if (!units.includes(product.unitOfMeasure)) errors.unitOfMeasure = 'Choose a unit of measure.';
    const text = String(input?.price ?? '').trim();
    const price = Number(text);
    if (!text) errors.price = 'Price is required.';
    else if (!Number.isFinite(price)) errors.price = 'Enter a valid price.';
    else if (price < 0) errors.price = 'Price cannot be negative.';
    else if (price > 99999.99) errors.price = 'Price cannot exceed $99,999.99.';
    else if (!/^\d+(\.\d{1,2})?$/.test(text)) errors.price = 'Use a number with up to two decimal places.';
    product.price = price;
    return { product, errors, valid: !Object.keys(errors).length };
  }
  const api = { validate, categories, units };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProductValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
