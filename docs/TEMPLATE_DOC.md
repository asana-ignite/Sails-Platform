# INIDOS Console — Template & Design System Guide

This document provides instructions on how to use, extend, and maintain the **INIDOS Console** design system.

## 1. Architectural Philosophy
The INIDOS Console uses a **Proprietary Vanilla CSS System** built with the **BEM (Block Element Modifier)** methodology. 
- **NO Frameworks**: Tailwind, Bootstrap, and other utility-first frameworks are strictly prohibited.
- **Prefix**: All CSS classes must be prefixed with `inidos-` (e.g., `.inidos-button`).
- **Standardization**: High consistency is maintained through a centralized design token system.

## 2. Design Tokens
All core styles are defined as CSS variables in `src/styles/design-tokens.css`. 

### Key Variables:
- **Colors**: `--inidos-primary` (#a47bc8), `--inidos-bg-body`, `--inidos-bg-sidebar`.
- **Typography**: `--inidos-font-family` (Lexend), `--inidos-font-size-base`.
- **Spacing**: Built on a base unit (`--inidos-spacing-unit: 8px`).
- **Shadows**: `--inidos-shadow-sm`, `--inidos-shadow-md`.

> **Usage Example**:
> ```css
> .inidos-custom-box {
>   background-color: var(--inidos-bg-card);
>   border: 1px solid var(--inidos-border-color);
>   border-radius: var(--inidos-radius-md);
> }
> ```

## 3. BEM Methodology
Follow strict BEM naming to ensure styles remain decoupled and scalable.

- **Block**: `.inidos-card`
- **Element**: `.inidos-card__header` (connected by `__`)
- **Modifier**: `.inidos-card--featured` (connected by `--`)

### Example Component:
```tsx
/* React Component */
<div className="inidos-card inidos-card--success">
  <div className="inidos-card__title">Task Completed</div>
  <div className="inidos-card__body">...</div>
</div>
```

## 4. Layout System
The application shell is managed by the `AppLayout` component (`src/components/layout/AppLayout.tsx`).

- **Topbar**: Sticky header with logo, search, and user profile.
- **Sidebar**: Collapsible navigation. Managed by a React state `isCollapsed` passed down as a prop.
- **Main Content**: Dynamic area that renders the children of `AppLayout`.

## 5. Icons & Typography
- **Icons**: Exclusively use `lucide-react`. 
- **Font**: **Lexend** is the primary typeface, loaded via Google Fonts in `index.html`.

## 6. Theme Management
The theme is controlled via the `data-inidos-theme` attribute on the `<html>` element.
- **Light Mode (Default)**: `<html data-inidos-theme="light">`
- **Dark Mode**: `<html data-inidos-theme="dark">`

Dark mode overrides are defined in `design-tokens.css` under the `[data-inidos-theme='dark']` selector.

## 7. Development & Testing
Testing is performed using the **Docker** environment to ensure consistency across development stages.

### Commands:
- **Start/Rebuild**: `docker compose up --build -d`
- **Stop**: `docker compose down`
- **Logs**: `docker compose logs console`
- **Access**: The UI is available at `http://localhost:5173`.

---
*Created for INIDOS Console by the Ignite Idea Engineering Team.*
