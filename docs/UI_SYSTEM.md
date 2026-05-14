# UI & Navigation System

## Architecture
- **Mobile Triple-Dock**: App Switcher (Left), Main Nav (Middle), Notifications/Profile (Right).
- **Desktop Sidebar**: Accordion mode (Expanded) or Flyout mode (Collapsed).

## "Ghost Glass" Design System Rules
- **Rule:** Backdrop Blur is `24px` for main panels, `20px` for overlays.
- **Rule:** Panel Backgrounds must be `rgba(255, 255, 255, 0.12)` (Light) or `rgba(0, 0, 0, 0.2)` (Dark).
- **Rule:** Borders must be `1px solid rgba(255, 255, 255, 0.2)` to define edges.
- **Rule:** Border radius: `24px` (Panels), `16px` (Cards), `12px` (Sub-menu items).

## Interactions & Layout
- **The Squeeze:** Active states use `transform: scale(0.9) translateY(2px)`.
- **Smart Dismissal:** Click-away closes panels. Only one mobile panel open at a time.
- **Page Container:** `.inidos-page-container` has `max-width: 1400px`.
- **Warning:** Header action hit-boxes MUST use `pointer-events: none` on container and `pointer-events: auto` on children to prevent invisible click-blocking.
- **Rule:** Overlays and slide-over drawers MUST use React Portals to ensure they sit at the document root.

## Module-First Shell
- **`AppPluginShell`**: Wraps custom modules. Resolves context, metadata, injects plugin, and harmonizes layout.
