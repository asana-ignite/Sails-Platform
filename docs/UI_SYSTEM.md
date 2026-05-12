# INIDOS Console: UI & Navigation System

This document details the high-fidelity navigation architecture and UI standards implemented for the **INIDOS** Console.

## 1. Navigation Architecture

### Mobile: Triple-Dock System
The mobile interface uses a persistent "Ghost Glass" bottom dock with three distinct panels:

| Panel | Trigger Position | Icon | Behavior |
| :--- | :--- | :--- | :--- |
| **App Switcher** | 1 (Far Left) | `LayoutGrid` (2x2) | Grid of major modules (Sales, Projects, Timesheets). |
| **Search Bar** | 2 (Left) | `Search` | Quick access to global data search. |
| **Main Nav (Tables)**| 3 (Middle) | `Menu` | Hierarchical navigation for internal data tables. |
| **Notifications** | 4 (Right) | `Bell` | User alerts and system updates. |
| **User Profile** | 5 (Far Right) | `User` | Account settings and session management. |

### Desktop: Hybrid Sidebar
A responsive sidebar that transitions between two states:
- **Expanded Mode**: Accordion-style navigation. Parent items expand to show children inline.
- **Collapsed Mode**: Fixed-position "Flyouts". Sub-menus pop up precisely next to the icon, bypassing container clipping.

---

## 2. Design Standards & "Ghost Glass" DNA

### Glassmorphism Tokens
- **Backdrop Blur**: `blur(24px)` for main panels, `blur(20px)` for overlays.
- **Panel Background**: `rgba(255, 255, 255, 0.12)` (Light) or `rgba(0, 0, 0, 0.2)` (Dark).
- **Borders**: `1px solid rgba(255, 255, 255, 0.2)` to define edges without adding visual weight.

### Geometry & Layout
- **Main Panels**: `border-radius: 24px`.
- **Icon Boxes / Cards**: `border-radius: 16px`.
- **Sub-menu Items**: `border-radius: 12px`.
- **Page Container**: All primary pages wrap content in `.inidos-page-container` (max-width: 1400px).
- **Content Spacing**: Standard gutter is `32px` (calc(var(--inidos-spacing-unit) * 4)).

### Iconography
- **Library**: `lucide-react`.
- **Standard Size**: `24px` for consistency across all grid and list levels.
- **Active States**: Icons transition to `white` or `var(--inidos-primary)` based on context.

---

## 3. High-Fidelity Interactions

### Physical Feedback (The "Squeeze")
All interactive grid elements (App Switcher, Mobile Nav) use hardware-accelerated transforms to simulate physical depth:
- **Active State**: `transform: scale(0.9) translateY(2px)`.
- **Sub-menu State**: `transform: scale(0.96) translateY(1px)`.
- **Highlight**: `rgba(157, 206, 224, 0.25)` (Steel Blue glow).

### Smart Dismissal
- **Click-Away**: Any panel automatically closes when the user clicks outside.
- **Mutual Exclusion**: Only one mobile panel (Nav, Search, or Switcher) can be open at a time.
- **Pointer-Events Isolation**: Hidden panels use `pointer-events: none`.

---

## 4. Technical Implementation Notes

- **Positioning**: Flyout sub-menus use `position: fixed` and `getBoundingClientRect()` to calculate screen coordinates.
- **Responsive Logic**: Breakpoints are managed via a mix of CSS `@media (max-width: 768px)` and React window listeners.
- **Scrolling**: `scrollbar-width: none` is used globally on navigation panels to maintain the minimal aesthetic.

---

## 5. Page Layout & Universal Shell

Every page within the INIDOS Console (Tables, Plugins, or Dashboards) follows a standardized layout structure.

### The Page Container (`.inidos-page-container`)
All pages are centered with a maximum width of **1400px** to maintain consistency on high-resolution displays.

### The "Identity Area" (Header)
All headers use the `.inidos-page-header` class with a horizontal flex layout.
- **Icon Wrapper**: A `42x42px` box with `var(--inidos-primary-light)` background.
- **Title Group**: Contains the main `h1` and an optional subtitle.
- **Plugin Badge**: Custom modules automatically display their parent module name as a badge.
- **Action Area**: Located on the far right (`.inidos-page-header__right`) for primary actions.

### Module-First Shell Architecture
Custom modules are wrapped in the **`AppPluginShell`**, which automatically:
1. Resolves the current module context (Sales, Projects, Timesheets).
2. Performs a metadata lookup to find the correct title and icon.
3. Injects the custom React plugin into the main content area.
4. Harmonizes the layout with the standard **`DynamicTablePage`**.

---

## 6. Design References (Ignite Idea Design System)

To ensure "Ghost Glass" consistency, all internal modules should reference the design tokens and established patterns:

- **Styles & Documentation**: [docs/SITE_STRUCTURE.md](./SITE_STRUCTURE.md)
- **Live Templates**: [docs/TEMPLATE_DOC.md](./TEMPLATE_DOC.md)

### Recommended Mappings for Internal Ops:
- **Sales Manager**: Use list views for Lead management and kanban views for Opportunity tracking.
- **Timesheet Entry**: Use optimized form layouts for rapid daily time logging.
- **Project Board**: Use interactive cards for task management and progress tracking.
