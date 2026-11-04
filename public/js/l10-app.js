/* AngularJS controllers, JSON/AJAX transport, jQuery search and cart integration. */
'use strict';
(function (angular, $, rules) {
  if (!angular || !$ || !rules) return;
  const app = angular.module('hubWorkflow', []);
  app.factory('HubApi', ['$http', function ($http) {
    function send(method, url, data) {
      return $http({ method, url, data, timeout: 15000, cache: false,
        headers: data === undefined ? {} : { 'Content-Type': 'application/json' } }).then(response => response.data);
    }
    return { get: url => send('GET', url), post: (url, data) => send('POST', url, data), patch: (url, data) => send('PATCH', url, data) };
  }]);
  app.factory('HubUI', ['$timeout', function ($timeout) {
    const uuid = () => window.crypto.randomUUID();
    function init(vm) {
      vm.errors = {}; vm.flash = null; vm.busy = false; vm.requestId = uuid();
      vm.categories = rules.categories; vm.reasons = rules.reasons; vm.conditions = rules.conditions; vm.countries = rules.countries;
      vm.clear = key => { delete vm.errors[key]; vm.flash = null; };
      vm.image = id => /^P10[1-5]$/.test(id) ? 'images/resources/' + id + '.svg' : 'images/resources/default.svg';
      vm.pretty = value => JSON.stringify(value, null, 2);
    }
    function focusError() {
      $timeout(() => (document.querySelector('[aria-invalid="true"]') || document.getElementById('form-feedback'))?.focus(), 0, false);
    }
    function invalid(vm, checked) {
      vm.errors = checked.errors; vm.flash = { type: 'danger', text: 'Please correct the highlighted fields before submitting.' }; focusError();
    }
    function failure(vm, error) {
      vm.errors = error.data?.errors || {};
      vm.flash = { type: 'danger', text: error.data?.message || 'The service could not be reached. Your details are still here. Try again.' }; focusError();
    }
    function key(vm, document) {
      const signature = JSON.stringify(document);
      if (vm.signature && vm.signature !== signature) vm.requestId = uuid();
      vm.signature = signature; return vm.requestId;
    }
    return { init, invalid, failure, uuid, key };
  }]);
  app.controller('SubmissionController', ['HubApi', 'HubUI', function (api, ui) {
    const vm = this; ui.init(vm); vm.form = {};
    vm.preview = () => rules.submission(vm.form).document;
    vm.startOver = () => { vm.saved = null; vm.form = {}; vm.errors = {}; vm.flash = null; vm.requestId = ui.uuid(); vm.signature = ''; };
    vm.submit = function () {
      if (vm.busy) return;
      const checked = rules.submission(vm.form);
      if (!checked.valid) return ui.invalid(vm, checked);
      vm.busy = true; vm.errors = {}; vm.flash = null;
      api.post('/api/submissions', { ...checked.document, requestId: ui.key(vm, checked.document) })
        .then(record => { vm.saved = record; }).catch(error => ui.failure(vm, error)).finally(() => { vm.busy = false; });
    };
  }]);
  app.controller('ApprovalController', ['HubApi', 'HubUI', function (api, ui) {
    const vm = this; ui.init(vm); vm.records = []; vm.status = 'pending'; vm.query = ''; vm.loaded = false;
    vm.count = status => vm.records.filter(item => item.status === status).length;
    vm.filtered = () => vm.records.filter(item => (!vm.status || item.status === vm.status) &&
      (!vm.query.trim() || [item.title, item.author, item.id].some(value => value.toLowerCase().includes(vm.query.trim().toLowerCase()))));
    vm.reload = function () {
      vm.busy = true; vm.flash = null;
      return api.get('/api/submissions').then(records => { vm.records = records; vm.loaded = true; })
        .catch(error => ui.failure(vm, error)).finally(() => { vm.busy = false; });
    };
    vm.decide = function (record, status) {
      if (vm.busy) return;
      vm.busy = true; vm.flash = null;
      api.patch('/api/submissions/' + encodeURIComponent(record.id), { status, expectedStatus: record.status }).then(updated => {
        vm.records = vm.records.map(item => item.id === updated.id ? updated : item);
        vm.flash = { type: 'success', text: updated.id + ' was ' + updated.status + '.' };
      }).catch(error => ui.failure(vm, error)).finally(() => { vm.busy = false; });
    };
    vm.reload();
  }]);
  app.controller('BillingController', ['HubApi', 'HubUI', function (api, ui) {
    const vm = this; ui.init(vm); vm.form = { address: { country: 'United States' }, payment: {} }; vm.items = []; vm.loaded = false;
    let cartStamp = '';
    vm.total = () => vm.items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
    vm.itemCount = () => vm.items.reduce((sum, item) => sum + item.quantity, 0);
    vm.payload = () => ({ ...vm.form, items: vm.items.map(item => ({ productId: item.productId, quantity: item.quantity })) });
    vm.redactedJSON = () => vm.pretty(rules.billing(vm.payload()).document);
    vm.load = function () {
      vm.loaded = false; vm.flash = null;
      return api.get('/api/products').then(products => {
        const cart = window.CommunityCart.read(); cartStamp = JSON.stringify(cart);
        vm.items = cart.map(entry => {
          const product = products.find(item => item.productId === entry.productId);
          if (!product) throw new Error('A cart resource is no longer available. Review your cart.');
          return { ...product, quantity: entry.quantity };
        });
        vm.loaded = true;
      }).catch(error => {
        if (error instanceof Error) vm.flash = { type: 'danger', text: error.message };
        else ui.failure(vm, error);
      });
    };
    vm.addSample = function () {
      try { window.CommunityCart.add('P101'); window.CommunityCart.add('P102'); vm.load(); }
      catch (error) { vm.flash = { type: 'danger', text: error.message }; }
    };
    vm.useDemoDetails = function () {
      const year = String(new Date().getUTCFullYear() + 2).slice(-2);
      vm.form = { fullName: 'Demo Reader', email: 'demo@example.com',
        address: { line1: '123 Example Lane', line2: '', city: 'Sample City', region: 'PA', postalCode: '16801', country: 'United States' },
        payment: { cardNumber: '4242 4242 4242 4242', expiration: '12/' + year, securityCode: '123' } };
      vm.errors = {}; vm.flash = null;
    };
    vm.submit = function () {
      if (vm.busy || !vm.loaded) return;
      try {
        if (JSON.stringify(window.CommunityCart.read()) !== cartStamp) throw new Error('Your cart changed in another page. Reload the summary before submitting.');
      } catch (error) { vm.flash = { type: 'danger', text: error.message }; return; }
      const checked = rules.billing(vm.payload());
      if (!checked.valid) return ui.invalid(vm, checked);
      vm.busy = true; vm.errors = {}; vm.flash = null;
      api.post('/api/billing', { ...vm.payload(), requestId: ui.key(vm, checked.document), expectedTotalCents: Math.round(vm.total() * 100) }).then(record => {
        vm.saved = record; vm.form.payment = {};
        try { window.localStorage.setItem('community-hub.last-order', record.id); } catch { /* Confirmation remains visible without local storage. */ }
      }).catch(error => ui.failure(vm, error)).finally(() => { vm.busy = false; });
    };
    vm.load();
  }]);
  app.controller('ReturnsController', ['HubApi', 'HubUI', function (api, ui) {
    const vm = this; ui.init(vm); vm.rows = []; vm.filteredRows = []; vm.query = ''; vm.form = {};
    vm.lookup = new URLSearchParams(window.location.search).get('order') || '';
    if (!vm.lookup) { try { vm.lookup = window.localStorage.getItem('community-hub.last-order') || ''; } catch { /* Manual lookup remains available. */ } }
    vm.search = function () {
      const term = vm.query.trim().toLowerCase();
      // jQuery searches JSON-backed order items. AngularJS renders the result state.
      vm.filteredRows = $.grep(vm.rows, item => !term || [item.name, item.productId, item.category].some(value => value.toLowerCase().includes(term)));
    };
    vm.selected = () => vm.rows.filter(item => item.selected);
    vm.amount = () => vm.selected().reduce((sum, item) => sum + Math.round(item.price * 100) * (Number(item.returnQuantity) || 0), 0) / 100;
    vm.payload = () => ({ ...vm.form, orderId: vm.order?.id || vm.lookup.trim().toUpperCase(),
      items: vm.selected().map(item => ({ productId: item.productId, quantity: item.returnQuantity })) });
    vm.loadOrder = function () {
      if (vm.busy) return;
      const orderId = vm.lookup.trim().toUpperCase();
      if (!/^ORD-[A-F0-9]{8}$/.test(orderId)) { vm.errors.orderId = 'Enter an order number such as ORD-12AB34CD.'; return; }
      vm.busy = true; vm.errors = {}; vm.flash = null; vm.order = null; vm.rows = []; vm.search();
      return api.get('/api/orders/' + encodeURIComponent(orderId)).then(order => {
        vm.order = order; vm.lookup = order.id; vm.query = '';
        vm.rows = order.items.map(item => ({ ...item, selected: false, returnQuantity: item.availableQuantity ? 1 : 0 })); vm.search();
      }).catch(error => ui.failure(vm, error)).finally(() => { vm.busy = false; });
    };
    vm.restart = () => { vm.saved = null; vm.form = {}; vm.requestId = ui.uuid(); vm.signature = ''; vm.loadOrder(); };
    vm.submit = function () {
      if (vm.busy) return;
      const checked = rules.returns(vm.payload());
      if (vm.selected().some(item => !Number.isInteger(item.returnQuantity) || item.returnQuantity > item.availableQuantity || item.returnQuantity < 1)) {
        checked.errors.items = 'Choose quantities within the remaining purchased amounts.'; checked.valid = false;
      }
      if (!checked.valid) return ui.invalid(vm, checked);
      vm.busy = true; vm.errors = {}; vm.flash = null;
      api.post('/api/returns', { ...checked.document, requestId: ui.key(vm, checked.document) })
        .then(record => { vm.saved = record; }).catch(error => ui.failure(vm, error)).finally(() => { vm.busy = false; });
    };
    if (vm.lookup) vm.loadOrder();
  }]);
  // Explicit bootstrap avoids jQuery-ready racing deferred application scripts on cached loads.
  angular.element(document).ready(function () {
    angular.bootstrap(document, ['hubWorkflow'], { strictDi: true });
  });
})(window.angular, window.jQuery, window.HubWorkflowRules);
