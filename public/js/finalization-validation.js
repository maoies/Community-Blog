/* Validation shared by the React form and the REST service. */
(function (root) {
  'use strict';
  const accessMethods = ['download', 'email', 'both'];
  const readingFormats = ['pdf', 'online'];
  const notificationFrequencies = ['none', 'weekly', 'monthly'];
  function validate(input) {
    const text = (key) => typeof input?.[key] === 'string' ? input[key].trim() : '';
    const document = {
      fullName: text('fullName'), email: text('email').toLowerCase(),
      accessMethod: text('accessMethod'), readingFormat: text('readingFormat'),
      notificationFrequency: text('notificationFrequency'), notes: text('notes'),
      consent: input?.consent === true,
      items: Array.isArray(input?.items) ? input.items.map((item) => ({ productId: item?.productId, quantity: item?.quantity })) : []
    };
    const errors = {};
    if (document.fullName.length < 2 || document.fullName.length > 80) errors.fullName = 'Enter your full name (2–80 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.email) || document.email.length > 254) errors.email = 'Enter a valid email address.';
    if (!accessMethods.includes(document.accessMethod)) errors.accessMethod = 'Choose how you would like to access your resources.';
    if (!readingFormats.includes(document.readingFormat)) errors.readingFormat = 'Choose your preferred reading format.';
    if (!notificationFrequencies.includes(document.notificationFrequency)) errors.notificationFrequency = 'Choose a notification frequency, including No updates if preferred.';
    if (document.notes.length > 500) errors.notes = 'Keep your notes within 500 characters.';
    if (!document.consent) errors.consent = 'Confirm your selections before submitting.';
    const ids = new Set();
    if (!document.items.length || document.items.length > 999 || document.items.some((item) => {
      const invalid = !/^P\d{3}$/.test(item.productId) || ids.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99;
      ids.add(item.productId);
      return invalid;
    })) errors.items = 'Select at least one available resource with a whole-number quantity from 1 to 99.';
    return { valid: Object.keys(errors).length === 0, errors, document };
  }
  const rules = { validate, accessMethods, readingFormats, notificationFrequencies };
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  else root.FinalizationValidation = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
