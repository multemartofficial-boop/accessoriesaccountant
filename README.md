# Garment Accountex

Build the UI/UX (frontend design only, dummy data fine, no backend logic yet) for an ERP web app for a garments accessories trading business. Use the 5 attached images only as visual style inspiration (layout pattern, spacing, card/table structure) — don't copy their content or exact design, adapt to this business. Avoid generic AI-SaaS look: no purple gradients, no cliché rounded cards, no stock illustrations. Neutral background, one accent color (navy/teal), sharp minimal borders, dense functional data tables.

Build pages for ALL these modules:

1. Dashboard — Total Sales/Purchase (day/month/year), Receivable, Payable, Cash & Bank balance, stock value, low stock alert list, top buyers, top-selling products, monthly sales/purchase chart.

2. Buyer Management — Buyer list, profile page (contact, credit limit, payment terms), sales history, outstanding balance, ledger, statement view.

3. Supplier Management — Supplier list, profile page, purchase history, payable balance, ledger, payment history.

4. Product/Accessories Master — Product list, add/edit form (SKU, category, unit, color, size, min stock level, purchase/sales price).

5. Purchase — Purchase Order form/list, Purchase Invoice, Supplier Payment form, pending PO list. (like image 3's detail/status layout)

6. Inventory — Stock list per product, stock in/out log, manual adjustment form, low-stock alert, stock movement history. (like image 1's product detail + tabs)

7. Sales — Sales Order form, Delivery Chalan, Sales Invoice, Sales Return, payment collection, sales history table.

8. Document Generator — Invoice and Chalan print/preview layout, split-screen form-left/preview-right. (like image 2)

9. Cash & Bank — Account balances, manual transaction entry, day-wise statement table.

10. Approval Workflow — Pending approvals list/queue, approve/decline detail view.

11. Audit Log — Activity log table (user, action, module, date/time, filterable).

12. VAT/Tax Management — Tax rate config page, VAT report table.

13. Financial Reports — P&L, Balance Sheet, Trial Balance, General Ledger, aging report pages. (like image 5's Journal/Chart of Accounts/Expenses/Payment layout — repeat same table pattern)

14. Multi-Warehouse — Warehouse list, warehouse-wise stock view, stock transfer form.

15. Reports & Analytics Center — Filterable report hub, export to Excel/PDF option.

16. Settings — Company profile (name, logo, address, contact info for invoice letterhead), user management (add/edit users, roles/permissions — Admin, Manager, Staff), invoice/document numbering format, tax/VAT default settings, currency settings, backup/data export, notification preferences (low stock alert threshold, etc.)

Sidebar should list all 16 modules grouped logically (Main operations, Accounting & Reports, Settings/Others), collapsible, with active-state highlight — similar navigation pattern to image 1 and image 5.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://garment-trade-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/18b00fcb-eaef-4855-ab55-133cc6e0d250).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
