/* Keep an explicitly selected static demonstration mode when changing pages. */
'use strict';
(function () {
  if (new URLSearchParams(window.location.search).get('demo') !== '1') return;
  for (const link of document.querySelectorAll('a[href]')) {
    const destination = new URL(link.href);
    if (destination.origin === window.location.origin && destination.pathname.endsWith('.html')) {
      destination.searchParams.set('demo', '1');
      link.href = destination.href;
    }
  }
})();
