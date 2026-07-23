# Project Backlog: KLAO (Ignite Idea Operating System)

## Active & Pending Phases

### Phase 8: Internal Modules (User & Project Management) (In Progress)
- [ ] **[PM]** Design JSON payloads for `ConsoleMenu` injection for Sales and Projects.
- [ ] **[Architect]** Define shared interfaces (`KlaoUser`, `KlaoTableDefinition`) in `packages/shared/src/index.ts`.
- [ ] **[Database]** Verify `prisma/schema.prisma` for `users`, `tables`, and `fields`.
- [ ] **[BackEnd]** Implement/Verify API endpoints ensuring the strict Security Pipeline is enforced.
- [ ] **[FrontEnd]** Build `UserManager.tsx` and `ObjectManager.tsx` in `packages/console/src/pages/custom/`. Register in `src/features/admin/registry.tsx`.
- [ ] **[QA]** Run security tests and verify frontend build.

### Phase 9: Staff Profile Refinement (Planned)
- [ ] **[Architect/Backend]** Update Users API and Database Structure to include:
    - Username / First Name / Last Name
    - Title / Department
    - Phone Number / Extension
    - Mobile Phone
- [ ] **[FrontEnd]** Update `UserManager.tsx` to reflect new staff structure.
- [ ] **[FrontEnd]** Enhance "Add User" drawer with activation toggle.

### Phase 10: Google Workspace Integration (Planned)
- [ ] **[Architect/DBA]**: Update `prisma/schema.prisma` to add an `allowed_domains` column to the `core.tenants` model.
- [ ] **[BackEnd]**: Implement Google Workspace domain mapping and JIT provisioning in `authOptions.ts`.
- [ ] **[FrontEnd]**: Design a "Workspace Settings" UI to manage whitelisted domains.
- [ ] **[QA]**: Verify secure domain routing and unauthorized access rejection.

---

## Recent Bugfixes & Patches (Completed)
- [x] **Metadata Schema Fix**: Added missing `is_system` boolean column to `core.tables` and `core.fields` to fix API 500 errors.
- [x] **Admin Recovery**: Successfully reset admin password and verified authentication flow.
- [x] **Documentation Standardization**: Restructured architecture docs and centralized standards into `DEVELOPMENT_STANDARDS.md`.

---

## Archived Phases (Completed)

### Phase 1: Core Engine & Metadata (100% Complete)
- [x] Initialize Next.js App Router project.
- [x] Setup Metadata Layer (Prisma).
- [x] Implement `AlchemaCore` Engine (SQL Generation).
- [x] Implement Plugin Architecture (`FieldRegistry`).
- [x] Implement `TranslatorLayer` (Metadata to DB Sync).
- [x] Implement Metadata CRUD API Routes.
    - [x] POST `/api/metadata/objects` (Create Table)
    - [x] POST `/api/metadata/fields` (Add Field)
    - [x] GET `/api/metadata/schema` (Fetch Full Schema)

### Phase 2: Dynamic Validation & Logic (70% Complete)
- [x] Database-level CHECK constraints implementation.
- [x] Dynamic Zod Schema Generator via `FieldRegistry` plugins.
- [ ] Logic for complex validation rules (Regex, Range, Enum plugins).
- [x] Interceptor-based Audit Trails within Database Transactions (`QueryLayer.ts`).

### Phase 3: Dynamic UI Layer → KLAO Console (100% Complete)
- [x] **Schema Provider**: Integrated into Admin UI components.
- [x] **Dynamic Form Engine**: Component that generates forms from Zod schemas.
- [x] **Dynamic Data Table**: Component that displays table data with server-side filtering/sorting.
- [x] **Field Components**: Specialized inputs (Select, Date, etc.) implemented in Admin UI.
- [x] **Migration**: Decoupled UI into `klao-console/` project.
- [x] **Dynamic Metadata Integration**:
    - [x] Implemented hierarchical `ConsoleApp` and `ConsoleMenu` database models.
    - [x] Created `ConsoleProvider` context for global navigation state.
    - [x] Integrated dynamic icon rendering via `DynamicIcon`.
    - [x] Implemented App Switcher with immediate sidebar sync.
- [x] **SPA Transition**:
    - [x] Migrated to `react-router-dom` with `<NavLink>`.
    - [x] Implemented dynamic entity routing via `/table/:tableName`.
    - [x] Applied `React.lazy()` and `Suspense` for all pages.
    - [x] Added premium `LoadingScreen` and `Spinner` components.
- [x] **Console Metadata APIs (Full CRUD)**:
    - [x] `POST /api/console/apps`: Dynamic app creation.
    - [x] `GET/PATCH/DELETE /api/console/apps/[id]`: Full app management.
    - [x] `POST /api/console/menus`: Dynamic menu/nav creation.
    - [x] `GET/PATCH/DELETE /api/console/menus/[id]`: Full nav management.

### Phase 4: Multi-Tenancy & Security (100% Complete)
- [x] Tenant metadata definition for Ignite Idea departments.
- [x] Automated Provisioning & Deduplication (`TenantProvisioner.ts`).
- [x] Row-level security (RLS) via `TransactionContext`.
- [x] Relation Fields & Foreign Keys constraint management.
- [x] `ConnectionManager` abstraction for internal isolation.
- [x] **Folder Structure Preparation**: Created auth logic directories.
- [x] **Auth Schema Definition (Prisma)**: Updated `prisma/schema.prisma`.
- [x] **API Surface Expansion**:
    - [x] `POST /api/tenant/users`: Endpoint for Admins to provision staff.
    - [x] `GET /api/users/me`: Endpoint to fetch current user's session and permissions.
- [x] **Security Layer Integration**: Finalized Auth.js bridge, RBAC/RLS plumbing, and QueryLayer atomic transactions.

### Phase 5: Verification & Polish (90% Complete)
- [x] Unit tests for `AlchemaCore` engine logic (`test-engine.ts`).
- [x] End-to-End integration test (Metadata Change → DB Sync).
- [x] **Security integration test suite** (`test-security.ts`) — 7 scenarios, all passing.
- [x] **User Management API Tests** (`test-user-api.ts`) — Verified /me and /tenant/users.
- [x] Transition Runtime Environment to **Bun**.
- [x] **Docker-based Dev Environment**: Implemented `Dockerfile` and `docker compose` for unified development.
- [ ] Performance benchmarking (DDL speed vs Metadata size).
- [x] Decouple UI into **KLAO Console** (`/packages/console`) project.
- [x] Generate `shared/types.ts` API contract for Console.
- [x] Documentation and Deployment.
- [x] **Refactoring (Profile → Team)**: Successfully renamed all references to Team for better organizational alignment.

### Phase 6: Advanced Metadata & Internal Features (100% Complete)
- [x] **Step 1: Database & Schema (Foundation)**
    - [x] Add `requiredCapability` to `ConsoleApp` and `ConsoleMenu` models.
    - [x] Implement `SystemPermission` model for Team-Capability mapping.
- [x] **Step 2: Backend Security Layer (Logic)**
    - [x] Implement `hasCapability` security utility.
    - [x] Update `GET /api/console/config` with dynamic capability filtering.
- [x] **Step 3: API Surface (Interface)**
    - [x] Create `GET /api/console/permissions` (Registry exposure).
    - [x] Create CRUD endpoints for `SystemPermission` assignments.
- [x] **Step 4: Automated Provisioning (Content)**
    - [x] Define "Settings & Admin" metadata structure JSON.
    - [x] Update `TenantProvisioner` for automated system app injection.
    - [x] Provision "Settings & Admin" for Ignite Idea.
- [x] **Step 5: Frontend Integration (Experience)**
    - [x] Create Admin UI route stubs in `klao-console`.
    - [x] Implement Permission Toggle component in Admin settings.

### Phase 7: Internal Ops & Team Security (100% Complete)
- [x] **N:M User-Team Relationship**: Join table (`UserTeam`).
- [x] **Active Team Context**: Implemented `activeTeamId` in session and `app.current_team_id`.
- [x] **Team-Level Ownership**: Introduced `owner_team_id` to dynamic tables for shared projects.
- [x] **Hardened Isolation**: Updated RLS policies to prevent internal data leakage.
- [x] **Additive Permission Model**: Capabilities aggregated across all team memberships.
