# Garments Accessories ERP Frontend

## Overview
Build a complete frontend-only ERP experience covering all 16 requested modules. The interface will use a neutral workspace, navy accent, light collapsible sidebar with a dark active state, compact controls, sharp borders, and dense tables inspired by the uploaded references without copying them.

## Navigation and structure
- Create a shared application shell with a collapsible desktop sidebar, mobile drawer, top search, notifications, and user menu.
- Group all modules under Main Operations, Accounting & Reports, and Settings & Others.
- Use route-driven active states and breadcrumbs so every navigation item opens a working screen.
- Keep related subviews inside each module as tabs or segmented controls where appropriate.

## Module screens
- **Dashboard:** period selectors, sales and purchase totals, receivable/payable, balances, stock value, alerts, ranked buyer/product tables, and monthly comparison chart.
- **Buyers and Suppliers:** searchable lists plus profile views with commercial terms, balances, history, ledger, statements, and payments.
- **Products and Inventory:** product master list and editor; stock overview, movement log, adjustment form, warehouse stock, alerts, and product-detail tabs.
- **Purchase and Sales:** order/invoice lists, transactional forms, status-led detail views, pending queues, returns, delivery chalan, payments, and histories.
- **Document Generator:** split-screen invoice/chalan editor and print preview.
- **Cash & Bank:** balance summary, transaction entry, and day-wise statement.
- **Approvals and Audit:** filterable queues/logs with approve/decline details and activity metadata.
- **VAT/Tax and Financial Reports:** tax configuration, VAT report, P&L, balance sheet, trial balance, general ledger, and aging reports using a consistent dense table language.
- **Warehouses and Analytics:** warehouse list, warehouse stock, transfer form, report hub, filters, and export controls.
- **Settings:** company letterhead profile, users and roles, numbering, tax, currency, exports, and notification preferences.

## Interaction and visual system
- Use navy as the sole strong accent, with neutral white/gray surfaces and restrained status colors.
- Favor 1px borders, small corner radii, compact row heights, clear numeric alignment, and minimal shadows.
- Add usable search, filters, tabs, forms, sidebar collapse, row selection, pagination, status controls, and local demo interactions.
- Use charts only where comparison benefits from visualization; keep operational content table-first.
- Ensure desktop and mobile layouts remain readable, with tables scrolling horizontally when needed.

## Technical details
- Implement TanStack routes for every top-level module and reusable shell/content components.
- Store all visual values as semantic Tailwind v4 tokens in the global design system.
- Use existing UI primitives and Lucide icons for controls and navigation.
- Use dummy in-memory data only; no authentication, persistence, or backend logic.
- Add unique metadata for every content route.
- Verify the complete navigation and representative forms/details in the running preview at desktop and mobile widths.
