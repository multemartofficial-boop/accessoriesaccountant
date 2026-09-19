# Purpose-built ERP module layouts

## Goal
Keep the existing modules, navigation, data, colors, and responsive behavior, while ensuring each screen uses the interaction pattern appropriate to its work instead of a repeated generic workspace.

## Changes
- Preserve buyer/supplier tables for lists, while retaining their dedicated profile header, commercial stats, and ledger/history views.
- Preserve product lists as tables and keep product creation/editing as a structured form.
- Preserve purchase and sales list summaries, while keeping order details, invoices, payments, returns, and collections as forms with line items, status, and totals.
- Keep inventory as a product inspector with stock summaries and movement history.
- Keep Documents as a form-and-print-preview workspace.
- Replace warehouse stock/list tables with warehouse summary cards and location-specific stock snapshots; retain the stock-transfer form.
- Keep Cash & Bank balances above its transaction ledger and dedicated transaction dialog.
- Keep Approvals as a selectable request queue with a detailed decision view, and Audit Log as a chronological feed.
- Keep VAT reporting tabular while preserving tax-rate settings and add/edit controls.
- Keep Financial Reports summary-led with report-specific detail tables, and Analytics as filters plus chart output.
- Replace the Settings users table with grouped user/role cards so Settings contains no data tables.

## Verification
- Check every module at desktop width and representative mobile widths.
- Verify tabs, forms, record selection, approve/decline, save, edit, delete, export, and navigation interactions.
- Confirm there are no runtime, console, or build errors.
