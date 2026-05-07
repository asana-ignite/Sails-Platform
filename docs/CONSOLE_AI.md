# KLAO Console — Frontend UI

## Product Identity
- **Product Name**: KLAO (pronounced "คลาว" / "cloud")
- **Full Name**: Key Leads, Orders & Activities
- **Domain**: `klao.app`
- **This Project**: **KLAO Console** — The frontend UI
- **Backend**: **KLAO Core** — Headless CRM Engine (`/klao-core`)

## Project Overview
KLAO Console is the frontend application for the KLAO CRM platform. It connects to the KLAO Core backend API to provide a visual interface for managing tenants, configuring data schemas (Tables and Fields), and performing CRUD operations on dynamic data.

## Technology Stack
- **Framework**: React + TypeScript (Vite)
- **Routing**: `react-router-dom` (v6+) with dynamic route registration
- **State Management**: `ConsoleProvider` (React Context) for global App/Navigation state
- **API Client**: Native Fetch with Vite Proxy to `klao-core` (host.docker.internal:3000)
- **Styling**: Vanilla CSS (BEM naming convention)
- **Iconography**: `lucide-react` with a `DynamicIcon` mapper for DB-driven icons

## Key Architectural Patterns
| Pattern | Implementation |
|---|---|
| **Dynamic Navigation** | Sidebar and Topbar consume the `useConsole` context which is hydrated from `GET /api/console/config`. |
| **App Switching** | Changing the Active App in the Topbar switcher immediately updates the Sidebar menu items via global state. |
| **SPA Routing** | All body content is loaded via `<Suspense>` and `React.lazy()`. Dynamic entities use the `/table/:tableName` route pattern. |
| **Global Loaders** | `LoadingScreen` (full-page) and `Spinner` (inline) components provide consistent feedback for async actions. |

## Standard Page Layout (Content Area)
All primary pages (Data Tables, Admin Plugins, Dashboards) MUST follow this structural hierarchy to maintain design consistency:

1. **Root Container**: Uses `display: flex; flex-direction: column; gap: var(--klao-spacing-unit) * 3`.
2. **Page Header (`.klao-page-header`)**:
   - **1. Icon Wrapper**: Dynamic icon representing the entity or module (Row).
   - **2 & 3. Title & Subtitle**: Stacked vertically, positioned to the right of the icon.
   - **4. Action Button Area (`__right`)**: Region for buttons, icons, or dropdowns, positioned on the far right.
   - **Layout**: The header uses `flex-direction: row` for the identity area.
3. **Content Area**:
   - Uses the global `klao-main-content` padding (4 units).
   - Content should be grouped in `.klao-card` units.
   - **DO NOT** add internal padding to the page root, as the shell already provides it.

## Folder Structure
/Users/asana/KLAO/klao-console/
├── src/
│   ├── components/
│   │   ├── layout/          ← Core structural components (Sidebar, Topbar, etc.)
│   │   └── common/          ← Reusable atoms (DynamicIcon, Spinner, LoadingScreen)
│   ├── contexts/
│   │   └── ConsoleContext.tsx ← Global state for Apps and Navigation
│   ├── pages/
│   │   ├── Dashboard.tsx    ← Main landing page
│   │   └── DynamicTablePage.tsx ← Generic entity management view
│   ├── styles/
│   │   ├── design-tokens.css ← CSS variables for colors, spacing, and typography
│   │   └── globals.css       ← Base resets and utility classes
│   └── App.tsx               ← Router and Context Provider entry point

## API Endpoints (KLAO Core Proxy)
The console proxies requests through Vite to the core backend.

### UI Metadata
- `GET /api/console/config` — Fetches hierarchical Apps and Menus for the active tenant.

### Metadata (Schema Management)
- `POST /api/metadata/objects` — Create a new Table
- `GET /api/metadata/objects` — List all Tables
- `POST /api/metadata/fields` — Add a Field to a Table
- `GET /api/metadata/[tableName]` — Get full Table schema (Fields + Rules)

### Dynamic Data (CRUD)
- `POST /api/dynamic/[tableName]` — Insert a record
- `GET /api/dynamic/[tableName]` — Query all records


## Future Constraint: PWA Offline-First Architecture (DO NOT IMPLEMENT YET)
> **See full spec:** [ROADMAP.md — Phase 4](file:///Users/asana/KLAO/klao-core/ROADMAP.md)

The following constraints are **pre-declared** for the Console (UI Layer). AI agents MUST NOT make architectural decisions that would block the offline sync pipeline described below.

| Constraint | Rule |
|---|---|
| **Client-Side ID Generation** | New records MUST have their `id` (UUIDv4) generated client-side (e.g., via `crypto.randomUUID()`) *before* any save action — online or offline. Never rely on the server to generate the ID. |
| **Local Storage (IndexedDB)** | Use **Dexie.js** as the in-browser database for caching schemas and records. No other mechanism (localStorage, sessionStorage) should be used for structured data. |
| **Mutation Queue (`SyncQueue`)** | Every Create/Update/Delete action MUST be written to a local `SyncQueue` table in IndexedDB first. The queue is flushed to the API via the **Background Sync API** (Service Worker) upon network restoration. |
| **Conflict Resolution** | On sync, the server uses **Last Write Wins** based on `updatedAt`. The client must supply the `updatedAt` timestamp (set at mutation time) when pushing queue entries to the API. |

