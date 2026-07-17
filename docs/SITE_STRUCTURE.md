# Site Structure & Architecture

## Universal Routing (`/:appSlug/:path*`)
- Extracts path and looks it up in DB for active tenant.
- **Rule:** `/` automatically redirects to `/dashboard`.
- **Resolution:**
  - `actionType === 'table'` → Renders `DynamicTablePage` (Automatic Data Grid).
  - `actionType === 'plugin'` → Renders `AppPluginShell` (Dynamic React Component).

## Monorepo Architecture
- **`packages/core`**: API logic, authentication, database interactions (Next.js).
- **`packages/console`**: Premium frontend interface (Vite).
- **`packages/shared`**: Shared-First Logic. Any logic/types used by both `core` and `console` MUST go here.

## Feature-Based Folder Structure (Frontend)
- **Location:** `packages/console/src/features/`
- **Rule:** Isolate domain logic. Each feature folder MUST contain its own `components/`, `hooks/`, `utils/`, and `types.ts`.
- **Warning:** Avoid Spaghetti Imports. Do not import `../../../` across feature boundaries. Use Shared Kernel (`@klao/shared`) for common types.

## Core Architecture (`packages/core/src/`)
- `api/`: API clients / wrappers.
- `features/`: Business logic implementations.
- `hooks/`: Reusable React hooks.
- `types/` & `utils/`: Legacy structure. **Migrate common items to Shared Kernel.**
