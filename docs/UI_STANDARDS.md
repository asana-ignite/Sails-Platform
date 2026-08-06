# UI Standards — Core UI Kit for Plugins

Every plugin (admin page, partner module, workflow event config UI, etc.) must
render its **list views** with the Core UI Kit so all plugins look and behave
identically. This document is the contract: what's standardized, what's free,
and the review gate.

## 1. The Kit

Location: `packages/console/src/components/ui/` — one barrel (`index.ts`),
one stylesheet (`ui.css`, theming via `design-tokens.css` variables only).

| Primitive | Component | Purpose |
|---|---|---|
| Card | `UiCard` / `UiTableCard` | Card shell / table card wrapper |
| Table | `UiTable` | The list table |
| Header | `UiTh` (+ `UiSortIcon`) | Sortable/static column header |
| Row | `UiTr` | Clickable / selectable row |
| Cell | `UiTd` | Table cell (align, colSpan) |
| Name cell | `UiNameCell` | Icon + primary + secondary (code) identity cell |
| Badge | `UiBadge` (tone) | neutral / success / warning / danger / info / default |
| Date cell | `UiDateCell` | Date display |
| Actions | `UiActionsMenu` + `UiActionsItem` + `UiActionsDivider` | The ⋮ context menu |
| Pagination | `UiPagination` | Range, page numbers, page-size select |
| Search | `UiSearchBar` | Debounced server query search |
| Empty | `UiEmptyState` | Empty state with optional Create action |
| Confirm | `UiConfirmDialog` | Destructive / state-changing confirmation (portal) |
| Toast | `UiToast` | Success/error feedback |
| Selection | `UiCheckboxTh` / `UiCheckboxTd` | Bulk-select lists (e.g. Users, Positions) |
| Button | `Button` | Standard button (variant/size) |

## 2. The Plugin List-View Recipe (behavior contract)

Every plugin list page MUST follow this flow:

1. **Fetch** with `fetchCached` → show `UiLoading` / error / `UiEmptyState` (with Create button)
2. **Search** via `UiSearchBar` → debounced `?search=` server query (reset page to 1)
3. **Table** = `UiTableCard > UiTable > thead(UiTh sortable) + tbody(UiTr)`
4. **Row click** = primary action · `UiActionsMenu` = secondary actions (activate/deactivate/delete)
5. **Pagination** = `UiPagination` (range + page-size), bottom of the card
6. **Confirm** every destructive/state-changing action with `UiConfirmDialog`
7. **Header Create** via `setHeaderActions` (parent shell)

Copy the shape from `AdminViewManager.tsx` (Layouts) or `AdminWorkflowManager.tsx`.

## 3. Standardized vs Free

**Standardized (must use the kit):** Card, Table, Column header, Sort icon, Row,
Badge, DateCell, Actions menu, Pagination, Search bar, Empty state, Confirm
dialog, Toast, Selection checkboxes.

**Free (plugins may own their styling):**
- Forms and field editors (add/edit dialogs, field config panels)
- WYSIWYG / canvas / drag-drop views (Layout Studio, workflow designer canvas)
- Tab structures, stat cards, detail panels, filters
- Plugin-specific accents composed onto kit primitives via `className`
  (e.g. `<UiBadge className="wf-flag">`)

**Rule:** plugin CSS may ADD accents to kit primitives — it may NEVER re-define
the base table/card/pagination/badge styles. If you're copying `padding: 12px
16px` for a table cell, you're doing it wrong — use `UiTd`.

## 4. Reviewer Checklist (plugin review gate)

- [ ] List view uses `UiTableCard`/`UiTable`/`UiTh`/`UiTr` — no hand-rolled `<table>` with inline styles
- [ ] Search uses `UiSearchBar`; pagination uses `UiPagination`
- [ ] Destructive actions go through `UiConfirmDialog`
- [ ] Status/type shown with `UiBadge` (tone) — no inline color literals
- [ ] No duplicated `.ui-*`/table CSS in the plugin's own stylesheet
- [ ] All colors/radii come from `design-tokens.css` variables (no hardcoded hex)

## 5. Migration History

The sweep migrated: ObjectManager (Data Models), AdminViewManager (Layouts),
AdminWorkflowManager (Workflows), UserManager (Users), AdminPositionManager
(Positions), AdminSSOConfig (SSO), AdminAuditLog (Audit), and deleted the
AdminUserManager mock. `lav-*` and duplicated list primitives were removed;
`om-*`/`sails-user-manager__*` remain only where plugin-specific detail views
legitimately need them (e.g. TeamManager's permission-matrix editors).
