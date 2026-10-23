# L7 Screenshots and PDF Submission Checklist

Use this checklist to document the L07 product management page. Include validation errors and success messages, product JSON, jQuery search and updates, relevant source code, and the actual contributors for each section.

## 0. Run the current version

The L07 page supports adding, searching, editing, saving, and exporting products as JSON. Product deletion and shopping cart features belong to the later L08 work.

Use Node.js 18 or newer. Open the project folder in VS Code, run `npm start`, and visit `http://localhost:3000/products.html`. The current page has both **Download JSON** and **Add product** in its toolbar.

For the course workspace, open zyBooks > Module 10 - Group Project > 10.2 L7: Group Work Project. Preserve the project folder structure when importing files and check for newer group changes before replacing files.

Relevant files:

- `public/products.html`
- `public/css/styles.css`
- `public/css/products.css`
- `public/js/product-catalog.js`
- `public/js/products.js`
- `public/data/products.json`
- `public/vendor/bootstrap.min.css`
- `public/vendor/jquery-3.7.1.min.js`

Use the HTTP server instead of opening the HTML file directly. jQuery loads `data/products.json` through an AJAX request.

## 1. Prepare screenshots

Create an `L7_Screenshots` folder. Maximize the browser or code editor separately. Do not submit split-screen screenshots.

- Windows: press Win + Shift + S, capture the area, and save it as PNG.
- Mac: press Command + Shift + 4 and select the area.

Keep enough page context to identify the feature. For code screenshots, include the filename and line numbers. Use multiple readable images instead of shrinking an entire file into one image.

## 2. Capture the product management page

Open **Products** and show the heading, navigation, search controls, product list, and product details editor.

Suggested filename: `01_Product_Page.png`.

## 3. Capture validation errors

Click the toolbar's **Add product** button. The editor should show **Add a new resource**.

The suggested ID is normally `P106` for the original five-product catalog. If it is already used, choose another unique ID and use that ID throughout the remaining steps.

Leave **Product name** and **Description** empty, enter `-1` as the price, and click the form's **Add product** button.

Capture the visible required-field and negative-price errors.

Suggested filename: `02_Validation_Error.png`.

## 4. Capture a successful addition

Complete the form with valid values:

| Field | Example |
| --- | --- |
| Product ID | P106, or another available ID |
| Product name | Weekend Reading Mini Guide |
| Description | A short digital guide with weekend reading ideas and discussion questions. |
| Category | Reading |
| Unit of measure | Download |
| Price | 3.99 |

Click the form's **Add product** button. Capture the new item in the list and its success message.

Suggested filename: `03_Add_Success.png`.

## 5. Capture jQuery search

Enter the new product's ID in **Search by ID or name**, then click **Search**.

Capture the query, matching product, and product details.

Suggested filename: `04_Search_Result.png`.

Optionally capture a category filter result as additional evidence. The suggested filenames do not establish a required screenshot count.

## 6. Capture a successful update

With the new item selected, change its price from `3.99` to `4.49` and click **Save changes**.

Capture the success message, updated form value, and updated list price.

Suggested filename: `05_Update_Success.png`.

## 7. Capture JSON that matches the page

Save or cancel any pending edits, then click **Download JSON**.

Open the downloaded `products.json` in VS Code and find the new product's ID. Capture the complete object, including `productId`, `description`, `category`, `unitOfMeasure`, and `price`. The saved example price should be `4.49`.

Suggested filename: `06_Updated_JSON.png`.

**Save changes** stores catalog changes in the current browser. **Download JSON** exports those saved values; it does not overwrite the server's source JSON file.

If the final submitted source catalog must match the demonstration, first back up `public/data/products.json`, then replace it with the reviewed export. Run the project again and confirm the values before capturing the final evidence.

## 8. Capture relevant code

Maximize the editor separately from the browser.

| File | Evidence to show |
| --- | --- |
| `products.html` | Bootstrap, CSS, and script references; navigation; form fields; validation message areas; buttons |
| `products.css` | Catalog and editor styling, layout, and mobile media queries |
| `product-catalog.js` | Required fields, unique IDs, price validation, `$.getJSON`, search, create, update, persistence, and JSON export |
| `products.js` | jQuery event handlers, form submission, validation, create/update calls, success/error messages, and result rendering |
| `products.json` | The current product object from the JSON capture |

Split the evidence across several screenshots where needed. Show your own references and use of Bootstrap and jQuery rather than screenshots of the entire minified libraries.

Keep the homepage and signup page in the website. Their previously submitted code does not need to be captured again for L07.

## 9. Assemble the PDF

Use readable black text and bold headings where useful. Suggested order:

1. Cover: Group 1, course, assignment title, and actual contributors.
2. Contribution section: each member's actual work.
3. Completed product management page.
4. Validation errors.
5. Successful product addition.
6. Search result.
7. Successful update.
8. Matching saved JSON.
9. Relevant source code.

For every section, include **Contributor:** followed by the responsible member or members. Describe actual participation.

The group roster is Frank Bai, Jiahao Gu, Seseena Abraham, and Tyler Sylvain. Confirm the participants before completing the contribution section.

Preserve image proportions and use extra pages when code needs more space. Include captions explaining the feature, code, and contributor. Avoid overlapping images and split-screen evidence.

Export the document as PDF. A suggested filename is `Group1_L07_Product_Management_Report.pdf`.

## 10. Check and submit

Open the PDF and check every page for readability, complete validation states, matching JSON values, captions, and contributor names.

Upload the required files to the L07 Canvas assignment and finish the submission. Reopen the submitted attachments to check them. Confirm the deadline and repeat-submission rules on the assignment page.

## Verification and repository status

Seventeen integration test groups passed using a Node HTTP server, jsdom 26.1.0, and the included full jQuery 3.7.1 library. Real-browser layout, responsiveness, native dialog focus, and native download behavior still need visual verification.

On October 23, 2026, L07 was merged into `main` through pull request #2 from `frank-l7-update`. Update `main` before creating a branch for L08 development.
