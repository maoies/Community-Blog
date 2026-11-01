// React calls these services; jQuery AJAX transports JSON to the existing Node API.
const $ = window.jQuery;
function ajax(method, url, data) {
  return new Promise((resolve, reject) => {
    $.ajax({ url, method, dataType: 'json', timeout: 15000, cache: false,
      ...(data === undefined ? {} : { contentType: 'application/json; charset=utf-8', processData: false, data: JSON.stringify(data) })
    }).done(resolve).fail((xhr) => {
      const error = new Error(xhr.responseJSON?.message || 'The project service could not be reached. Run npm start, then try again.');
      error.errors = xhr.responseJSON?.errors || {};
      reject(error);
    });
  });
}
export const service = {
  products: () => ajax('GET', '/api/products'),
  save: (document) => ajax('POST', '/api/finalizations', document),
  confirmation: (id) => ajax('GET', '/api/finalizations/' + encodeURIComponent(id))
};
