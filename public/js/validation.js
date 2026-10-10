// Shared by the browser and Node.js so both validate the same fields.
(function (root) {
  'use strict';
  function validateMember(input) {
    const text = (key) => typeof input?.[key] === 'string' ? input[key].trim() : '';
    const member = {
      fullName: text('fullName'),
      email: text('email').toLowerCase(),
      phone: text('phone'),
      age: Number(input?.age),
      address: text('address')
    };
    const errors = {};
    if (member.fullName.length < 2 || member.fullName.length > 80)
      errors.fullName = 'Enter a full name between 2 and 80 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email) || member.email.length > 254)
      errors.email = 'Enter a valid email address, such as alex@example.com.';
    if (!Number.isInteger(member.age) || member.age < 13 || member.age > 120)
      errors.age = 'Enter a whole-number age between 13 and 120.';
    if (member.address.length < 5 || member.address.length > 200)
      errors.address = 'Enter an address between 5 and 200 characters.';
    const digits = member.phone.replace(/\D/g, '');
    if (member.phone && (!/^[+\d\s().-]+$/.test(member.phone) || digits.length < 7 || digits.length > 15 || member.phone.length > 30))
      errors.phone = 'Enter a phone number with 7–15 digits, or leave it blank.';
    return { member, errors, valid: Object.keys(errors).length === 0 };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validateMember };
  else root.MemberValidation = { validateMember };
})(typeof globalThis !== 'undefined' ? globalThis : this);
