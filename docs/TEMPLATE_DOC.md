# KLAO Console — Template & Design System Guide

This document provides instructions on how to use, extend, and maintain the **KLAO Console** design system.

## 1. Architectural Philosophy
The KLAO Console uses a **Proprietary Vanilla CSS System** built with the **BEM (Block Element Modifier)** methodology. 
- **NO Frameworks**: Tailwind, Bootstrap, and other utility-first frameworks are strictly prohibited.
- **Prefix**: All CSS classes must be prefixed with `klao-` (e.g., `.klao-button`).
- **Standardization**: High consistency is maintained through a centralized design token system.

## 2. Design Tokens
All core styles are defined as CSS variables in `src/styles/design-tokens.css`. 

### Key Variables:
- **Colors**: `--klao-primary` (#a47bc8), `--klao-bg-body`, `--klao-bg-sidebar`.
- **Typography**: `--klao-font-family` (Lexend), `--klao-font-size-base`.
- **Spacing**: Built on a base unit (`--klao-spacing-unit: 8px`).
- **Shadows**: `--klao-shadow-sm`, `--klao-shadow-md`.

> **Usage Example**:
> ```css
> .klao-custom-box {
>   background-color: var(--klao-bg-card);
>   border: 1px solid var(--klao-border-color);
>   border-radius: var(--klao-radius-md);
> }
> ```

## 3. BEM Methodology
Follow strict BEM naming to ensure styles remain decoupled and scalable.

- **Block**: `.klao-card`
- **Element**: `.klao-card__header` (connected by `__`)
- **Modifier**: `.klao-card--featured` (connected by `--`)

### Example Component:
```tsx
/* React Component */
<div className="klao-card klao-card--success">
  <div className="klao-card__title">Task Completed</div>
  <div className="klao-card__body">...</div>
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
The theme is controlled via the `data-klao-theme` attribute on the `<html>` element.
- **Light Mode (Default)**: `<html data-klao-theme="light">`
- **Dark Mode**: `<html data-klao-theme="dark">`

Dark mode overrides are defined in `design-tokens.css` under the `[data-klao-theme='dark']` selector.

## 7. Development & Testing
Testing is performed using the **Docker** environment to ensure consistency across development stages.

### Commands:
- **Start/Rebuild**: `docker compose up --build -d`
- **Stop**: `docker compose down`
- **Logs**: `docker compose logs console`
- **Access**: The UI is available at `http://localhost:5173`.

---
*Created for KLAO Console by the Ignite Idea Engineering Team.*
