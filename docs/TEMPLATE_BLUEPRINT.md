# SAILS Console: Template Blueprint

This document outlines the structural and visual DNA for the **SAILS Console**, serving as the design foundation for Ignite Idea's internal operating system.

## 1. High-Level Semantic Structure

The template follows a standard modern admin layout using a wrapper-based approach.

| Component | Semantic Tag / ID | Primary CSS Classes | Notes |
| :--- | :--- | :--- | :--- |
| **Main Wrapper** | `#layout-wrapper` | N/A | Contains the entire application layout. |
| **Top Navbar** | `<header>` | `.topbar` | Includes search, notifications, and staff profile. |
| **Sidebar (Nav)** | `<div>` | `.sidebar`, `.vertical-menu` | Managed by MetisMenu for nested navigation. |
| **Main Content** | `<div>` | `.main-content` | Right-side container for all module data. |
| **Inner Wrapper** | `<div>` | `.page-content` | Provides standard padding around content. |
| **Grid System** | `<div>` | `.container-fluid`, `.row`, `.col-*` | Standard Bootstrap 5 Responsive Grid. |
| **Page Header** | `<div>` | `.page-title-box` | Contains page titles and breadcrumbs. |

---

## 2. Design Tokens

Extracted from `_variables.scss` and `src/assets/scss/`.

### Key Colors
| Token | Variable | Hex/RGB | Usage |
| :--- | :--- | :--- | :--- |
| **Primary** | `$primary` | `#a47bc8` | Brand actions, active states. |
| **Secondary** | `$secondary` | `#5288af` | Neutral actions, secondary buttons. |
| **Success** | `$success` | `#4ec5ad` | Positive indicators, badges. |
| **Danger** | `$danger` | `#fd6161` | Errors, delete actions. |
| **Warning** | `$warning` | `#f4d078` | Notifications, warnings. |
| **Info** | `$info` | `#7588de` | General info markers. |
| **Body BG** | `$body-bg` | `#f2f2f4` | Main page background color. |
| **Sidebar BG** | `$leftsidebar-dark-bg`| `#252b3b` | Dark mode sidebar background. |
| **Text Primary**| `$body-color` | `#343a40` | Main body text color. |
| **Text Muted** | `$gray-600` | `#74788d` | Secondary/muted text. |

### Typography
- **Primary Font:** `"Funnel Sans", sans-serif` (Modern, clean sans-serif)
- **Secondary Font:** `"Lexend", sans-serif` (Used for specific UI elements)
- **Monospace Font:** `SFMono-Regular, Menlo, Monaco, Consolas...`
- **Base Font Size:** `0.8125rem` (~13px)
- **Headings:** Semibold (`600`) by default.

### Spacing & Borders
- **Base Spacer:** `1rem` (16px).
- **Grid Gutter:** `16px`.
- **Border Radius:**
  - Default: `4.8px`
  - Large (`-lg`): `0.4375rem` (~7px)
  - Small (`-sm`): `4px`
  - Extra Large (`-xl`): `1rem` (16px)

---

## 3. Asset Strategy

### Iconography
The template uses a multi-library strategy but prioritizes **Eva Icons** for the main dashboard interface.

- **Primary Icons:** [Eva Icons](https://akveo.github.io/eva-icons/) (Implemented via `data-eva` attributes and SVG injection).
- **Secondary Icons:** 
  - [Material Design Icons (MDI)](https://materialdesignicons.com/)
  - [FontAwesome 6](https://fontawesome.com/)
  - [Bootstrap Icons](https://icons.getbootstrap.com/)

### Storage & Paths
- **Fonts:** Located in `assets/fonts/`. Includes local webfont files for MDI and FontAwesome.
- **Images:** Located in `assets/images/`.
  - `dashboard/`: Scene-specific vectors and illustrations.
  - `users/`: Avatar placeholders.
  - `flag/`: Country SVG icons.
- **Libraries:** Third-party vendor files are stored in `assets/libs/` (e.g., ApexCharts, Select2, DataTables).

---

## 4. Key Component Patterns

- **Cards:** Heavy use of `.card` with `.shadow-sm` and `.border-0`.
- **Dashboards:** Built using **ApexCharts** (configured via `data-colors` attributes).
- **Interactivity:** Uses **MetisMenu** for the sidebar and **SimpleBar** for custom scrollable areas.
- **Dropdowns:** Standard Bootstrap dropdowns with `.dropdown-menu-animated`.
