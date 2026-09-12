# Premium ERP interaction pass

## Goal
Keep every existing module, page, field, and data point while turning the current frontend into a polished, fully click-through client demo.

## What will change
- Refine the shared visual system with soft-neutral workspaces, premium bordered surfaces, subtle shadows, 8px corners, stronger typography, and purposeful navy/green/amber/red accents.
- Upgrade KPI cards with metric-specific icons and accent rails, larger values, clearer labels, and more breathing room.
- Improve dashboard charts with smooth curves, dual gradient fills, lighter dashed grids, richer tooltips, and a dot legend.
- Polish the sidebar and top bar with clearer group rhythm, active indicators, refined hover states, integrated search, and stronger separation from content.
- Add shared modal forms with required-field validation, success feedback, edit-prefill behavior, and delete confirmation.
- Make table rows selectable, add working edit/delete menus, and show the appropriate detail/profile view when a record is selected.
- Make global and local search, filters, date ranges, and Day/Month/Year controls affect the displayed dummy data.
- Wire approval decisions, document actions, report exports, settings saves, and form submissions to in-memory state with visible feedback.

## Interaction coverage
- All 16 sidebar destinations will be checked.
- Every primary create/add/record button will open a relevant form.
- Tabs will render distinct content, not only change appearance.
- Representative create, edit, delete, approve, decline, search, filter, export, print, and save flows will be tested.

## Technical notes
- Frontend only; state resets on refresh.
- Existing TanStack routes and current information architecture remain unchanged.
- Reusable interaction primitives will be added rather than duplicating modal and feedback logic per screen.
- Desktop and mobile layouts will be verified in the running preview.