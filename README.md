# The Community Hub

An IST 256 community storefront with a homepage, member management, product
management, and a separate L08 shopping cart. All products are sample digital
resources; no payment or real order is created.

## Run

Use Node.js 18 or newer:

```sh
npm start
```

Open `http://localhost:3000/`. Choose **Products** to manage the catalog or
**Cart** to browse resources and build a cart. Runtime dependencies are not
required: Bootstrap and full jQuery 3.7.1 are bundled in `public/vendor/`.

## L08 behavior

- Search the product catalog by ID, name, or description, and filter by category.
- Add resources, edit quantities (whole numbers 1–99), remove items, undo the
  last removal, and confirm before clearing the entire cart.
- Preserve pending quantity edits when another cart row changes. Validate
  quantities inline and show success/error messages beside the relevant action.
- Show per-item prices, line subtotals, item count, and total in USD. Arithmetic
  uses integer cents. Unavailable products remain removable and block export.
- Prepare and download a JSON document with complete product fields, quantity,
  line subtotal, currency, and totals. The server recalculates prices when
  checking the cart; preparing the document does not create an order.
- Create, edit, and delete products from the product management page. Deletion
  requires confirmation; unsaved drafts and overlapping saves are protected.
- Responsive cart and catalog layouts, labeled controls, live status messages,
  keyboard-accessible dialogs, and navigation between all four pages.

## AJAX and data

`public/js/product-catalog.js` uses `$.ajax()` with JSON request bodies and these
HTTP methods. The included Node demonstration API makes them executable now;
the endpoints can be replaced with the group's later backend.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Read the product collection |
| POST | `/api/products` | Create a validated product |
| PUT | `/api/products/P101` | Update a product with conflict detection |
| DELETE | `/api/products/P101` | Delete a product after confirmation |
| POST | `/api/cart/preview` | Validate cart JSON and return current prices/totals |

Products contain `productId`, `description`, `category`, `unitOfMeasure`, and
numeric `price`; a `name` is included for display. Shared validation rules are
in `public/js/product-validation.js`. Both the browser and API validate input.

`public/data/products.json` is the tracked seed catalog. The Node server creates
`data/products.json` on the first product write and persists subsequent changes
there. This runtime file is ignored by Git. Other browsers using the same server
see the shared catalog when they load a page. Member data remains separate in
`data/members.json`. Carts belong to individual browsers and use localStorage.

If hosting only static files (including a static classroom workspace), an absent
product endpoint selects the browser demonstration mode. It loads the seed JSON
using jQuery and saves product changes/deletions locally. The product page and
cart preview identify this mode. Run `npm start` to exercise real HTTP writes and
shared product storage. Network/server errors do not silently select a different
catalog. Older L07 browser-only product edits are retained, but are not silently
published to the shared server catalog.

Preview hosts that do not implement API routes can use `cart.html?demo=1` or
`products.html?demo=1` to explicitly select browser-only demonstration mode.
This mode makes no product API requests and does not publish browser edits.

## Files

| Files | Responsibility |
| --- | --- |
| `public/cart.html`, `public/css/cart.css` | Shopping cart structure, responsive styling and dialogs |
| `public/js/cart-store.js`, `public/js/cart.js` | Cart state, validation, totals, jQuery search, interactions and export |
| `public/products.html`, `public/css/products.css`, `public/js/products.js` | Product form, list, delete confirmation and add-to-cart entry |
| `public/js/product-catalog.js`, `public/js/product-validation.js` | Shared catalog, AJAX methods and validation |
| `public/js/navigation.js` | Preserve explicit static demo mode between pages |
| `lib/product-api.js`, `server.js` | Demonstration REST endpoints and JSON persistence |
| `public/data/products.json` | Product JSON document with the required fields |
| `tests/l08.test.js`, `tests/regression.test.js` | L08 checks and existing member/L07 regressions |

The product controller and cart controller both use `ProductCatalog` and
`CommunityCart`. `cart-items`, `cart-product-list`, `summary-total`, and
`cart-json` are the cart's main rendering targets. The product form's field IDs
match the JSON property names.

## Test

```sh
npm ci
npm test
```

The tests cover real jQuery/HTTP requests, CRUD, validation errors and successes,
cart updates and totals, persistence, unavailable products, stale edits,
static-host fallback, failed storage, navigation/assets, and member regressions.
They use temporary member/product files and do not modify the seed catalog.
All 21 automated tests passed. Separate desktop and mobile browser checks
covered cart layout, quantity errors and updates, dialog focus and Escape,
prepared JSON values, and product form creation/deletion. Native download
completion could not be confirmed by the browser automation interface.

## Design references

- [Shopify cart template patterns](https://shopify.dev/docs/storefronts/themes/architecture/templates/cart): line items, quantity updates, removal and summaries.
- [Bootstrap validation](https://getbootstrap.com/docs/5.3/forms/validation/): labeled controls and visible field feedback.
- [jQuery AJAX](https://api.jquery.com/jQuery.ajax/): HTTP methods and JSON request/response handling.
