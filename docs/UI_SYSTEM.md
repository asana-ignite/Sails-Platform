# KLAO Console: UI & Navigation System

This document details the high-fidelity navigation architecture and UI standards implemented for the KLAO Console.

## 1. Navigation Architecture

### Mobile: Triple-Dock System
The mobile interface uses a persistent "Ghost Glass" bottom dock with three distinct panels:

| Panel | Trigger Position | Icon | Behavior |
| :--- | :--- | :--- | :--- |
| **App Switcher** | 1 (Far Left) | `LayoutGrid` (2x2) | 3x3 grid of major application modules. |
| **Search Bar** | 2 (Left) | `Search` | Quick access to global data search. |
| **Main Nav (Tables)**| 3 (Middle) | `Menu` | Hierarchical navigation for tables and folders. |
| **Notifications** | 4 (Right) | `Bell` | User alerts and system updates. |
| **User Profile** | 5 (Far Right) | `User` | Account settings and session management. |

### Desktop: Hybrid Sidebar
A responsive sidebar that transitions between two states:
- **Expanded Mode**: Accordion-style navigation. Parent items expand to show children inline.
- **Collapsed Mode**: Fixed-position "Flyouts". Sub-menus pop up precisely next to the icon, bypassing container clipping (`overflow: auto`) using dynamic coordinate tracking.

---

## 2. Design Standards & "Ghost Glass" DNA

### Glassmorphism Tokens
- **Backdrop Blur**: `blur(24px)` for main panels, `blur(20px)` for overlays.
- **Panel Background**: `rgba(255, 255, 255, 0.12)` (Light) or `rgba(0, 0, 0, 0.2)` (Dark).
- **Borders**: `1px solid rgba(255, 255, 255, 0.2)` to define edges without adding visual weight.

### Geometry
- **Main Panels**: `border-radius: 24px`.
- **Icon Boxes / Cards**: `border-radius: 16px`.
- **Sub-menu Items**: `border-radius: 12px`.

### Iconography
- **Library**: `lucide-react`.
- **Standard Size**: `24px` for consistency across all grid and list levels.
- **Active States**: Icons transition to `white` or `var(--klao-primary)` based on context.

---

## 3. High-Fidelity Interactions

### Physical Feedback (The "Squeeze")
All interactive grid elements (App Switcher, Mobile Nav) use hardware-accelerated transforms to simulate physical depth:
- **Active State**: `transform: scale(0.9) translateY(2px)`.
- **Sub-menu State**: `transform: scale(0.96) translateY(1px)`.
- **Highlight**: `rgba(157, 206, 224, 0.25)` (Steel Blue glow).

### Smart Dismissal
- **Click-Away**: Any panel automatically closes when the user clicks outside (on the main content area).
- **Mutual Exclusion**: Only one mobile panel (Nav, Search, or Switcher) can be open at a time; opening one automatically closes the others.
- **Pointer-Events Isolation**: Hidden panels use `pointer-events: none` to prevent "ghost" blocking of underlying elements.

---

## 4. Technical Implementation Notes

- **Positioning**: Flyout sub-menus use `position: fixed` and `getBoundingClientRect()` to calculate screen coordinates, ensuring they never clip.
- **Responsive Logic**: Breakpoints are managed via a mix of CSS `@media (max-width: 768px)` and React window listeners to ensure state sync.
- **Scrolling**: `scrollbar-width: none` is used globally on navigation panels to maintain the minimal aesthetic while preserving full scrollability for high-density lists.

---

## 5. Page Layout & Universal Shell

Every page within the KLAO Console (Tables, Plugins, or Dashboards) follows a standardized layout structure to ensure visual cohesion.

### The "Identity Area" (Header)
All headers use a horizontal flex layout with a steel-blue background for the icon wrapper.
- **Icon**: Dynamic icon representing the entity (size: 24px).
- **Title**: Large, bold label (e.g., "Leads").
- **Subtitle**: Contextual description or capability badge.

### App-First Shell Architecture
Custom modules are wrapped in the **`AppPluginShell`**, which automatically:
1. Resolves the current app context (CRM, Sales, Admin).
2. Performs a metadata lookup to find the correct title and icon.
3. Injects the custom React plugin into the main content card.

### Dynamic Rendering Logic
The system automatically chooses the rendering engine based on the **`actionType`** in the database:
- `actionType: 'table'` → Renders the **Dynamic Data Grid**.
* `actionType: 'plugin'` → Renders the **Custom Plugin Shell**.
