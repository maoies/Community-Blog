# L10 coverage map

| Requirement | Implementation |
| --- | --- |
| Submission page | submission.html and SubmissionController |
| Approval page | approval.html and ApprovalController |
| Billing details and cart summary | billing.html and BillingController |
| Return form, product pictures and search | returns.html and ReturnsController |
| HTML/CSS/Bootstrap | Four pages, l10.css, existing Bootstrap grid and form classes |
| JavaScript validation | l10-validation.js, shared by browser and server |
| JSON data | Request bodies and three persisted collections |
| AJAX | AngularJS $http in the HubApi service |
| AngularJS | ng-model, ng-repeat, controllers, preview and dynamic summaries |
| jQuery search | $.grep filters purchased-resource JSON in ReturnsController |
| Node.js | workflow-api.js registered in server.js |
| Create/list/update operations | POST/GET/PATCH routes |
| Storage | Atomic JSON-file writes |
| Evidence | Browser screenshots, API responses, full related source and report excerpts |
| Contributions | Actual work must be confirmed; MOU roles are recorded as planned responsibilities |

The assignment contains two different page scopes. The implementation covers both, using AngularJS for new pages because it is accepted in the first section and explicitly requested in the additional requirements.
