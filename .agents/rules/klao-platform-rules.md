---
trigger: always_on
description: Mandatory development and deployment rules for the Klao Platform.
---

# Klao Platform Rules

All development, testing, and deployment activities MUST adhere to the following rules:

## 1. Development Environment (Docker)
- **Mandatory Docker Usage**: Use the local `docker-compose.yml` for all testing and deployment verification.
- **Service Ports**:
  - **Database (PostgreSQL 16)**: External: `5433`, Internal: `5432`.
  - **Core (Next.js API)**: Port `3000`.
  - **Console (Vite Frontend)**: Port `5173`.
- **Command Workflows**:
  - Start all services: `docker compose up -d` (Use `--build` only if `package.json` or `Dockerfile` changes).
  - Rebuild core/console: `docker compose up --build <service_name>`.
  - Database Migrations: Run `bun x prisma migrate dev` ONLY when `schema.prisma` is modified.
  - Schema Sync: `bun x prisma generate` should be run after migrations to update the client types.

## 2. Monorepo Architecture
- **Package Separation**:
  - `packages/core`: Handles API logic, authentication, and database interactions.
  - `packages/console`: Premium frontend interface.
  - `packages/shared`: Shared types, constants, and utilities.
- **Dependency Management**: Use `bun` for all package management tasks. Do not use `npm` or `yarn`.
- **Architectural Standards**:
  - **Shared-First Logic**: Logic or types used by both `core` and `console` MUST be placed in `packages/shared`.
  - **Absolute Imports**: Use path aliases (e.g., `@/components/`) instead of relative paths for better maintainability.

## 3. Technology Stack
- **Runtime**: Bun (Latest).
- **Frontend**: React + Vite (Console), Next.js (Core).
- **ORM**: Prisma with PostgreSQL.


## 4. Git & Code Integrity
- **Exclusion Rules**: Never commit `node_modules`, build artifacts, or `.env` files.
- **Lock Files**: Maintain `bun.lock` as the single source of truth for dependencies.
- **Schema Changes**: Always generate and commit Prisma client updates after modifying `schema.prisma`.

## 5. Code Quality & Reliability
- **Self-Documenting Code**: Complex logic (especially in `core/engine`) MUST include comments explaining the rationale.
- **Robust Error Handling**: Wrap database queries and external API calls in `try/catch` blocks with standardized logging.

## 6. Plugin Architecture Standards
- **Lifted State for Persistence**: Plugin-specific UI states (Drawers, Modals) MUST be lifted to `ConsoleContext` to survive platform re-mounts during header action registration.
- **Header Hit-Box Safety**: Header containers (`.klao-page-header__left`) MUST use `pointer-events: none` on the container and `pointer-events: auto` on children to prevent invisible click-blocking.
- **Mandatory Portaling**: Use `React Portals` for all slide-over drawers to ensure they sit at the document root, bypassing shell `overflow` or `z-index` constraints.
- **Standard Z-Index**: Administrative overlays must strictly use `z-index: 9999 !important` for deterministic visibility.