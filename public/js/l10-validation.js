/* Shared JavaScript validation for AngularJS forms and Node.js endpoints. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HubWorkflowRules = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const categories = ['Community Stories', 'Events', 'Reading', 'Creative Life', 'Resources'];
  const reasons = ['Wrong resource selected', 'File access issue', 'Incorrect format', 'Other'];
  const conditions = ['Not accessed', 'Accessed', 'File unavailable'];
  const countries = ['United States', 'Canada', 'China', 'United Kingdom', 'Other'];
  const text = value => typeof value === 'string' ? value.trim() : '';
  const result = (document, errors) => ({ valid: !Object.keys(errors).length, document, errors });
  function field(errors, key, value, min, max, label) {
    if (value.length < min || value.length > max) errors[key] = label + ' must contain ' + min + '-' + max + ' characters.';
  }
  function selections(input, errors) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 50) {
      errors.items = 'Choose at least one resource (up to 50).'; return [];
    }
    const ids = new Set();
    return input.map(item => {
      const productId = text(item?.productId), quantity = item?.quantity;
      if (!/^P\d{3}$/.test(productId) || ids.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
        errors.items = 'Choose unique resources with whole-number quantities from 1 to 99.';
      ids.add(productId); return { productId, quantity };
    });
  }
  function submission(input = {}) {
    const errors = {};
    const document = Object.fromEntries(['title', 'author', 'category', 'summary', 'content'].map(key => [key, text(input?.[key])]));
    field(errors, 'title', document.title, 5, 100, 'Title');
    field(errors, 'author', document.author, 2, 60, 'Author name');
    field(errors, 'summary', document.summary, 20, 250, 'Summary');
    field(errors, 'content', document.content, 50, 5000, 'Post content');
    if (!categories.includes(document.category)) errors.category = 'Choose a category from the list.';
    return result(document, errors);
  }
  function luhn(number) {
    let sum = 0, double = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let digit = Number(number[i]); if (double && (digit *= 2) > 9) digit -= 9;
      sum += digit; double = !double;
    }
    return sum % 10 === 0 && !/^0+$/.test(number);
  }
  function billing(input = {}, now = new Date()) {
    input = input || {};
    const errors = {}, address = {}, payment = input.payment || {};
    for (const key of ['line1', 'line2', 'city', 'region', 'postalCode', 'country']) address[key] = text(input.address?.[key]);
    const fullName = text(input.fullName), email = text(input.email).toLowerCase();
    field(errors, 'fullName', fullName, 2, 80, 'Full name');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address for digital delivery.';
    field(errors, 'line1', address.line1, 3, 120, 'Street address');
    field(errors, 'city', address.city, 2, 80, 'City');
    field(errors, 'region', address.region, 2, 80, 'State or region');
    if (address.line2.length > 120) errors.line2 = 'Use 120 characters or fewer.';
    if (!countries.includes(address.country)) errors.country = 'Choose a country.';
    if (address.country === 'United States' ? !/^\d{5}(-\d{4})?$/.test(address.postalCode) : !/^[A-Za-z0-9 -]{2,16}$/.test(address.postalCode))
      errors.postalCode = address.country === 'United States' ? 'Enter a 5-digit ZIP code or ZIP+4.' : 'Enter a postal code with 2-16 characters.';
    const raw = text(payment.cardNumber), digits = raw.replace(/[ -]/g, '');
    if (!/^[\d -]+$/.test(raw) || !/^\d{13,19}$/.test(digits) || !luhn(digits)) errors.cardNumber = 'Enter a valid demonstration card number.';
    const expiration = text(payment.expiration), match = expiration.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!match || 2000 + Number(match[2]) < now.getUTCFullYear() ||
      (2000 + Number(match[2]) === now.getUTCFullYear() && Number(match[1]) < now.getUTCMonth() + 1))
      errors.expiration = 'Use a current or future expiration date in MM/YY format.';
    if (!/^\d{3,4}$/.test(text(payment.securityCode))) errors.securityCode = 'Enter a 3- or 4-digit demonstration security code.';
    const items = selections(input.items, errors);
    // Only the sanitized payment representation may be saved or previewed.
    return result({ fullName, email, address, payment: { method: 'demo_card', last4: digits.slice(-4), expiration }, items }, errors);
  }
  function returns(input = {}) {
    input = input || {};
    const errors = {};
    const document = { orderId: text(input.orderId), items: selections(input.items, errors), reason: text(input.reason), condition: text(input.condition), notes: text(input.notes) };
    if (!/^ORD-[A-F0-9]{8}$/.test(document.orderId)) errors.orderId = 'Enter the order number from your billing confirmation.';
    if (!reasons.includes(document.reason)) errors.reason = 'Choose a return reason.';
    if (!conditions.includes(document.condition)) errors.condition = 'Choose the condition of the digital resources.';
    if (document.notes.length > 500) errors.notes = 'Use 500 characters or fewer.';
    if (document.reason === 'Other' && document.notes.length < 10) errors.notes = 'Describe the issue in at least 10 characters.';
    return result(document, errors);
  }
  return { categories, reasons, conditions, countries, submission, billing, returns };
});
