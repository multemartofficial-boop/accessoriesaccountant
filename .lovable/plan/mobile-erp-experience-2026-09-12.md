# Mobile ERP experience

## Goal
Make the existing ERP feel purpose-built for 375–430px phones while preserving every desktop screen and workflow.

## Implementation
- Replace the mobile sidebar with a fixed five-item bottom navigation for Dashboard, Sales, Purchase, Inventory, and More.
- Build a slide-up More drawer containing every remaining module, with clear active states and 44px minimum tap targets.
- Create a slim mobile header with brand, expandable full-width search, and notifications; retain the existing desktop header.
- Render shared data tables as compact mobile record cards using the most important visible fields, status badges, tap-to-open behavior, and accessible edit/delete actions. Keep desktop tables unchanged.
- Change mobile tabs into horizontally scrolling pill controls.
- Use two-column KPI grids, stacked panels/forms/details, and mobile-safe chart sizing; preserve desktop grids.
- Add sticky mobile action areas to order details, transaction forms, product forms, approvals, and other save/submit views.
- Apply safe-area spacing so fixed navigation and actions never cover page content.

## Verification
- Check Dashboard, Buyers, Products, Purchase, Inventory, Approvals, Documents, and Settings at phone widths.
- Confirm bottom navigation, More drawer, search, tabs, record cards, detail opening, and fixed actions work.
- Confirm representative desktop pages still use the sidebar, tables, and multi-column layouts.