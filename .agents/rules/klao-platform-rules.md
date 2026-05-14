---
trigger: always_on
description: Mandatory development and deployment rules for the Klao Platform.
---

# Klao Platform Rules

## 1. Development Environment (Docker)
- **Mandatory Usage**: Local `docker-compose.yml` for testing.
- **Ports**: DB: `5433` (Ext) / `5432` (Int). Core: `3000`. Console: `5173`.
- **Warning**: Run `bun x prisma migrate dev` ONLY when `schema.prisma` is modified.
- **Warning**: Run `bun x prisma generate` immediately after migrations.

## 2. Monorepo Architecture
- **Rule (Shared-First)**: Logic/types used by BOTH `core` and `console` MUST be placed in `packages/shared`.
- **Dependency Management**: Use `bun` ONLY. Do not use `npm` or `yarn`. Keep `bun.lock` as the source of truth.
- **Absolute Imports**: Use path aliases (e.g., `@/components/`); no relative path spaghetti.

## 3. Code Quality & Reliability
- **Rule**: Wrap DB queries and external API calls in `try/catch` with standardized logging.
- **Rule**: Complex logic in `core/engine` MUST include rationale comments.
- **Git**: Never commit `node_modules`, build artifacts, or `.env`.

## 4. Plugin Architecture Standards
- **Rule (Lifted State)**: Plugin UI states (Drawers/Modals) MUST be lifted to `ConsoleContext` to survive platform re-mounts.
- **Warning (Hit-Box Safety)**: Header containers (`.klao-page-header__left`) MUST use `pointer-events: none` on container and `pointer-events: auto` on children.
- **Rule (Portaling)**: Use `React Portals` for ALL slide-over drawers to sit at document root.
- **Rule (Z-Index)**: Administrative overlays MUST use `z-index: 9999 !important`.