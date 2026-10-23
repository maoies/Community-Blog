# The Community Hub

An IST 256 Community Blog storefront with a homepage, member sign-up, and
L7 product management for digital guides, magazines, and resource bundles.

## Run the project

Use Node.js 18 or newer:

```sh
npm start
```

Open `http://localhost:3000/`. The navigation links to **Products** and
**Sign Up**. Bootstrap and full jQuery 3.7.1 are bundled in `public/vendor/`;
no dependency installation is needed to run the site.

Use the HTTP server instead of opening HTML files directly. Product data loads
through jQuery AJAX, and member registration uses the server API.

## Features

- Separate product management page with ID/name search and a category filter.
- Create and edit products with stable, unique IDs and field-level validation.
- Product ID, name, description, category, unit of measure, and numeric USD price.
- Browser storage, JSON export, save feedback, and unsaved-change confirmation.
- Loading, empty, no-results, retry, and storage-error states.
- Member registration and editing, including protection for newer drafts when
  an earlier save is still pending.
- Responsive navigation and layouts; a scrollable member table on small screens.

## Product data and sharing

`public/data/products.json` is the shared starting catalog. Product saves update
the current browser's localStorage and visible list. They do not update the
repository or another browser. This is the L7 storage design; a shared product
backend and shopping cart are future work.

To share catalog changes with the group:

1. Save or discard the current draft, then select **Download JSON**.
2. Review the exported product records and replace
   `public/data/products.json` in the repository with that export.
3. Commit the updated JSON so teammates can get the same starting catalog.
4. An existing browser may still apply its own saved product changes. Export
   any changes you need before clearing that site's saved data to load only
   the newly shared catalog.

Member records are stored separately in `data/members.json` by the existing
member API. Automated tests use temporary data and leave that file unchanged.

## Main files

| File | Purpose |
| --- | --- |
| `public/index.html` | Storefront homepage and navigation |
| `public/signup.html`, `public/js/signup.js` | Member form, validation feedback, and asynchronous saves |
| `public/products.html`, `public/js/products.js` | Product search and editor interactions |
| `public/js/product-catalog.js` | jQuery loading, catalog search, validation, storage, and JSON export |
| `public/data/products.json` | Shared sample catalog |
| `public/css/` | Shared and product-page styles |
| `public/images/slow-reading-v2.svg` | Optimized homepage image with embedded WebP data |
| `server.js` | Static files with appropriate MIME types and the member API |
| `tests/regression.test.js` | Automated regression checks |

## Tests

Install the locked development dependencies, then run the included checks:

```sh
npm ci
npm test
```

The Node test runner and jsdom check delayed member saves, draft preservation,
save errors and retries, duplicate submissions, member API behavior, image MIME
types, HEAD responses, page assets, and L7 catalog loading/search/validation/
creation/editing/restoration with the bundled jQuery library.

jsdom does not verify visual layout, native dialog focus, or actual browser
downloads. Those require a browser check.
