# The Community Hub

An IST 256 Community Blog storefront with the existing L6 homepage and member
sign-up, plus an L7 Product Details and management page with creation, search, and updates.

## Run the project

Install Node.js 18 or newer, open a terminal in this folder, and run:

```sh
npm start
```

Open `http://localhost:3000/`, then choose **Products**, or open
`http://localhost:3000/products.html` directly. Runtime dependencies are not
required. Bootstrap and full jQuery 3.7.1 are included locally.

Use the HTTP server rather than double-clicking an HTML file: product JSON is
loaded through AJAX, and member registration uses the existing server API.

## What L7 adds

- A separate Product Details page with the existing palette and Bootstrap grid.
- Five example digital resources, with Product ID, Description, Category,
  Unit of Measure, Price, and an additional product name.
- Case-insensitive ID/name search and a category filter, used together.
- Add product opens a blank form with a suggested unique ID. Required fields and duplicate IDs are checked.
- An editor for name, description, category, unit, and price. Saved product IDs stay fixed.
- Required-field checks, nonnegative prices, at most two decimal places, and
  field-level errors. A zero price is allowed.
- Immediate list updates, save feedback, and a discard/keep-editing dialog.
- Loading, empty, no-results, load-error/retry, and storage-error states.
- Download JSON for the saved catalog, with stable IDs and numeric prices.

The homepage and sign-up content are retained. Both receive one Products link;
shared navigation wraps on small screens. Existing member JavaScript and member
storage are unchanged. The only server change is the JSON content type.

## Files to review

| File | Purpose |
| --- | --- |
| `public/products.html` | Product list, search, editor, and navigation |
| `public/css/products.css` | Product-page styling and responsive rules |
| `public/data/products.json` | Shared source catalog |
| `public/js/product-catalog.js` | jQuery JSON loading, search, validation, updates, export |
| `public/js/products.js` | Form/list events, messages, unsaved-change handling |
| `public/vendor/jquery-3.7.1.min.js` | Full jQuery, including AJAX |
| `public/vendor/JQUERY-LICENSE.txt` | jQuery MIT license |

## How saving works

The source is `public/data/products.json`. On load, the catalog applies valid
saved changes and newly created products from this browser's localStorage. Saving updates both the browser
copy and the visible list. The page reports success only after storage succeeds.
Both new and edited products are included in the saved and exported JSON. Failed saves retain the draft. Same-product conflicts with newer saved changes
are rejected rather than silently overwritten.

This does **not** write to the server's JSON file or share edits across browsers,
devices, ports, or origins. Clearing site data removes browser-saved edits. Use
**Download JSON** to keep the current saved catalog as a file. To make an export
the source catalog for the whole group, review it and replace
`public/data/products.json` in the project manually. Product backend endpoints
are not part of this L7 extension.

## Reuse for L8

Load these scripts in order on a future cart page:

```html
<script defer src="vendor/jquery-3.7.1.min.js"></script>
<script defer src="js/product-catalog.js"></script>
<script defer src="js/cart.js"></script>
```

Inside `cart.js`, after the page is ready:

```js
$(function () {
  ProductCatalog.load().then(function () {
    const matches = ProductCatalog.search('reading', 'Reading');
    const product = ProductCatalog.getById('P101');
    // Render matches; store product.productId and quantity in cart items.
    // Resolve descriptions/prices from this catalog when rendering the cart.
  }).catch(function () {
    // Show a load error and a retry action.
  });
});
```

`getAll()` and `getById()` return copies. Use `update()` to save validated edits.
`money(price)` formats USD; `toJSON()` exports the current saved catalog.
Cart behavior and transport to its future REST API still belong to L8.

## Verification

17 integration groups passed with the actual full jQuery library, a Node HTTP
server, and jsdom 26.1.0. Checks covered adding products, unique IDs, canceled new drafts, creation conflicts, AJAX loading, search/filter combinations,
all editor fields, price validation, saved-data restoration in a fresh document,
JSON export contents, unsaved edits, safe text rendering, failed/corrupt storage,
conflicts, loading/retry/empty states, assets/navigation, and existing member
registration/update. Tests used a temporary member data file.

The managed browser preview could not start because of an environment permission
error. Real-browser rendering, responsive layout, native dialog focus, and the
native download interaction remain unverified.

## Design references

- jQuery getJSON: https://api.jquery.com/jquery.getjson/
- Shopify save/discard pattern: https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api

The implementation uses the existing Community Hub design. It does not depend
on Shopify or use Shopify code.
