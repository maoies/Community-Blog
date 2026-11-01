# The Community Hub — L09

An IST 256 Community Blog project with an Options / Finalization page for
confirming digital resources and choosing access and reading preferences.
All products are sample digital resources; no payment or real order is created.

## Run

Use Node.js 18 or newer:

```sh
npm start
```

Open `http://localhost:3000/`. Choose **Products** to manage the catalog or
**Cart** to browse resources and build a cart. Choose **Preferences** for the L09
Options / Finalization page, or open `http://localhost:3000/finalization.html`.
The delivered version runs without installing packages: Bootstrap and jQuery
are bundled in `public/vendor/`, and React is included in the generated local
`public/js/finalization.bundle.js` file.

## L09 additions — Options / Finalization

L09 continues the Community Blog theme by letting users confirm their digital
resource selections and choose access and reading preferences. The existing
folder structure and pages are retained. New code is placed in `data`,
`lib`, `public`, and `tests`.

### New page and behavior

- Added `public/finalization.html`, accessible through **Preferences** in the
  navigation on every page and **Continue to preferences** in the shopping cart.
- Carry saved cart resource IDs and quantities into the form. Users may also
  select resources directly on the preferences page.
- Collect full name, email, access method (download link, email link, or both),
  reading format (PDF or online reading), notification frequency (none, weekly,
  or monthly), optional notes, and confirmation that the selections were reviewed.
- Validate required fields, email format, allowed option values, notes length,
  resource selections, quantities, and the review confirmation in JavaScript.
- Use React components and state to update the selected resources, catalog value,
  and preference summary without reloading the page.
- Use jQuery AJAX to load the existing product catalog and send the form as a
  JSON document to the REST API.
- Save confirmed options in `data/finalizations.json` and display the returned
  confirmation ID, resource summary, preferences, and saved JSON.
- **Reload saved confirmation** retrieves the persisted record through a GET
  request. Failed submissions keep the form available for correction or retry.
- Preserve the existing CSS palette and use Bootstrap form controls and grids
  for a consistent, responsive page.

This classroom feature records preferences only. It does not process payments,
send emails, or deliver actual resources.

### L09 code files

| File | Purpose |
| --- | --- |
| `public/finalization.html` | Page structure, navigation, and React mounting point |
| `public/css/finalization.css` | Preferences form, summary, confirmation, and responsive styling |
| `public/js/finalization.jsx` | Editable React components, form state, validation feedback, and dynamic rendering |
| `public/js/finalization-api.js` | jQuery AJAX service calls used by React |
| `public/js/finalization-validation.js` | Validation rules shared by the browser and server |
| `public/js/finalization.bundle.js` | Generated browser bundle including React and React DOM |
| `lib/finalization-api.js` | REST handler, server validation, and JSON persistence |
| `lib/build-finalization.js` | Build the React source into the local browser bundle |
| `data/finalizations.json` | Collection of saved finalization records; initially an empty array |
| `tests/l09.test.js` | Finalization API, validation, persistence, and retry tests |

The existing `server.js` registers the new handler. The existing pages gain a
Preferences navigation link, and `cart.html` gains the continuation link.
`package.json` and `package-lock.json` include React, React DOM, esbuild, and the
build command. The React library license is in `public/vendor/REACT-LICENSE.txt`.

### L09 REST API and JSON storage

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Read the existing resource catalog |
| POST | `/api/finalizations` | Validate and save the submitted options document |
| GET | `/api/finalizations` | Read the saved confirmation collection |
| GET | `/api/finalizations/:id` | Read one saved confirmation |

The POST sends `application/json`. The server validates the fields, checks that
resources still exist, and recalculates values using current catalog prices.
It returns HTTP 201 and saves a record containing `id`, `requestId`,
`schemaVersion`, `status`, `createdAt`, `options`, and `selection`.
An identical retry with the same request ID returns the existing record instead
of creating a duplicate. Member and product storage remain separate.

The L09 page requires the Node server for real AJAX and file storage. The older
static-only catalog demo mode does not save finalization records.

### Editing and building L09

Run the delivered site with `npm start` or `node server.js`. To change the React
source, edit `public/js/finalization.jsx` or `public/js/finalization-api.js`, then:

```sh
npm ci
npm run build
npm test
```

`npm run build` regenerates `public/js/finalization.bundle.js`. Keep both the
editable source and generated bundle in the project. Changes to HTML, CSS,
shared validation, or the Node handler do not require rebuilding the React
bundle; restart the server after changes to its handlers.

## L09 verification

The five finalization tests in `tests/l09.test.js` cover field validation,
server-calculated values, saved JSON, persistence after restart, duplicate
retries, concurrent submissions, catalog changes, storage errors, navigation,
and local assets. All 26 project tests passed after integration.

Separate browser checks verified cart selections, React state, inline errors,
JSON AJAX transport, saved confirmation retrieval, retry after a lost response,
removed-resource recovery, and responsive layout.

## References

- [React createRoot](https://react.dev/reference/react-dom/client/createRoot)
- [jQuery AJAX](https://api.jquery.com/jQuery.ajax/)
- [Bootstrap forms](https://getbootstrap.com/docs/5.3/forms/overview/)
