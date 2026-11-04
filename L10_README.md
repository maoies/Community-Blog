# Community Hub - L10

This extends L09 commit `26e3a24584ddeeae722e974b18bafa20d8064eb0` and covers both page scopes in the assignment: community submission/review and billing/returns.

## Run

Use Node.js 18 or newer. No package installation is needed to run the delivered pages; their browser dependencies are included.

    node server.js

Open these pages using localhost:

- http://localhost:3000/submission.html
- http://localhost:3000/approval.html
- http://localhost:3000/billing.html
- http://localhost:3000/returns.html

The original pages and APIs remain available. New pages use AngularJS 1.8.3, Bootstrap and jQuery 3.7.1. The existing L09 React page remains separate.

## Demonstrate the workflows

1. Submit a community story. The sidebar updates its title, category, author and summary live.
2. Open Review. Expand the full post, approve it and reload. Submit a second post to demonstrate rejection.
3. Add resources on Cart and open Billing. An empty cart also provides an explicit sample-resource action.
4. Select "Use demonstration details" and submit. Keep the returned order number.
5. Follow "Request a return". Search the purchased resources, select an item, and choose a reason and condition.
6. Submit the request, then reload the order to see the remaining quantities.

Use fictional details only. The sample number is `4242 4242 4242 4242`, with a future MM/YY and sample code `123`.
No charge, email, resource delivery or refund occurs. Raw card numbers and security codes are excluded from saved files, localStorage, JSON previews and responses.

## JSON storage and REST endpoints

| Operation | Endpoint |
| --- | --- |
| Create/list submissions | POST/GET /api/submissions |
| Read a submission | GET /api/submissions/:id |
| Approve/reject | PATCH /api/submissions/:id |
| Read the existing catalog | GET /api/products |
| Save demonstration billing | POST /api/billing |
| Read an order and returnable quantities | GET /api/orders/:id |
| Create a return | POST /api/returns |
| Read a return | GET /api/returns/:id |

The new collections are `data/submissions.json`, `data/orders.json` and `data/returns.json`.
The server calculates order amounts from catalog prices. Return amounts use purchase-time prices.
Previously requested quantities are excluded from return availability. POST request IDs prevent duplicate records on retries, and review updates check the expected previous status.
Writes use a temporary file followed by atomic rename. Storage is intended for one local Node process.

This is a course demonstration with no moderator authentication or production payment processing. AngularJS is the legacy framework named in the assignment.

## Verification

    node --test tests/l10.test.js

For the existing L06-L09 regression suites, install the original development dependencies, then run `npm test`.
See the delivered verification results for actual execution outcomes. Browser screenshots show the real application, with fictional data.

## Design references and original work

- Bootstrap Checkout: https://getbootstrap.com/docs/5.3/examples/checkout/
- Bootstrap form validation: https://getbootstrap.com/docs/5.3/forms/validation/
- Tabler form elements: https://preview.tabler.io/form-elements.html
- Tabler table layout: https://preview.tabler.io/tables.html

These were layout references. The L10 markup, controllers, validation, REST service and resource-cover SVGs were written for Community Hub, using its existing colors and typography.
Third-party distributions retain their license files in `public/vendor`.

## Contribution review before submission

The implementation, verification and report in this package were prepared with coding assistance for Frank Bai.
The previous MOU assigns UI/report work to Frank Bai, frontend behavior to Seseena Abraham, backend/data to Jiahao Gu, and testing/integration to Tyler Sylvain.
These are responsibility areas, not verified claims of individual L10 contributions. Each active member should review the package and confirm their actual work before the contribution section is submitted.
