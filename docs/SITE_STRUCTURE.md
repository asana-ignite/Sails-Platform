# KLAO Console: Site Structure

This document provides a comprehensive overview of the project's file structure, detailing the purpose and responsibility of each component within the KLAO Console architecture.

## 1. Project Root & Configuration
Files related to the environment, build system, and high-level documentation.

| File | Purpose | Description |
| :--- | :--- | :--- |
| `package.json` | Dependencies | Manages project metadata, scripts, and NPM packages. |
| `vite.config.ts` | Build System | Configuration for Vite (HMR, build optimizations). |
| `scripts/` | Tooling | Utility scripts for database maintenance and resets. |
| `tests/` | QA | Integration tests for the platform engine and security. |
| `docker-compose.yml` | Infrastructure | Container orchestration for development environments. |

---

## 2. Universal Routing & URL Structure
The platform uses a **Universal Metadata-Driven Router** to handle all application-level navigation.

- **URL Pattern**: `/:appSlug/:path*`
- **Dynamic Matching**: The system extracts the path and looks it up in the database for the active tenant.
- **Component Resolution**:
    - If `actionType === 'table'`: Renders **`DynamicTablePage`** (Automatic Data Grid).
    - If `actionType === 'plugin'`: Renders **`AppPluginShell`** (Dynamic React Component).
- **Default Pathing**: The root `/` path automatically redirects to `/dashboard`.

### Navigation Examples:
| Goal | Browser URL | Resolution |
| :--- | :--- | :--- |
| **Leads Table** | `/crm/leads` | CRM App > Leads (Table) |
| **Sales Orders** | `/sales/orders` | Sales App > Orders (Table) |
| **User Management**| `/admin/users` | Admin App > Users (Plugin) |
| **Custom Feature** | `/custom-app/tool`| Custom App > Tool (Plugin) |

---

## 3. Core Architecture (`src/`)
The foundational layers of the enterprise-grade platform.

| Directory | Purpose | Description |
| :--- | :--- | :--- |
| `api/` | Data Access | Centralized API clients and service wrappers (`client.ts`). |
| `features/` | Business Logic | Modular feature implementations and registries (`registry.ts`). |
| `hooks/` | Reusable Logic | Custom React hooks for shared behavior (`useClickOutside.ts`). |
| `types/` | Type Safety | Global TypeScript interfaces and type definitions (`index.ts`). |
| `utils/` | Utilities | Shared helper functions and formatting tools (`index.ts`). |
| `constants/` | Data Models | Centralized constants like `navigation.tsx`. |

---

## 3. UI System (`src/components/`)
Modular and reusable interface components.

### UI Components (`src/components/ui/`)
Primitive components that follow the "Ghost Glass" design system.

| File | Purpose | Description |
| :--- | :--- | :--- |
| `Button.tsx` | UI Primitive | Standard KLAO button with multiple variants and sizes. |

### Layout Components (`src/components/layout/`)
High-level structural components.

| File | Purpose | Description |
| :--- | :--- | :--- |
| `AppLayout.tsx` | Orchestrator | Coordinates the Topbar, Sidebar, and Mobile Dock panels. |
| `Sidebar.tsx` | Desktop Nav | Multi-mode sidebar (Accordion / Collapsed Flyouts). |
| `MobileGlobalBar.tsx` | System Dock | Persistent bottom bar for global navigation. |


---

## 4. Design & Styles (`src/styles/`)
The visual identity and token system.

| File | Purpose | Description |
| :--- | :--- | :--- |
| `design-tokens.css` | Variables | Centralized CSS variables for colors, spacing, and glass effects. |
| `globals.css` | Reset/Base | Global CSS resets and utility classes for typography and layout. |
| `admin-common.css` | Admin Shared | Centralized patterns for admin modules (Modals, Forms, Placeholders). |

---

## 5. Application Content (`src/pages/`)
Specific view-level logic and styling.

| File | Purpose | Description |
| :--- | :--- | :--- |
| `Dashboard.tsx` | Home View | Main administrative dashboard with stats and activity overviews. |
| `Dashboard.css` | View Styles | Specific styling for dashboard widgets and grid layout. |

---

## 6. Reference Assets (`_assets_references/`)
These files are kept for design reference and original template functionality.

- **`icons-fontawesome.html`**: Reference for FontAwesome icons.
- **`assets/libs/`**: Original template libraries (ApexCharts, MetisMenu, etc.).
