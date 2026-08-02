# SAILS Platform — Agent Guide

Multi-tenant, schema-per-tenant platform. Monorepo: `packages/core` (Next.js API + Prisma + engine), `packages/console` (Vite React admin UI), `packages/shared` (types).

## Golden Rules (read first — these prevent the most common AI-caused outages)

1. **Never put writes/seeding/"auto-repair" inside runtime API GET handlers.** Schema and menu changes go in migrations or one-off scripts. (This exact mistake once blanked the entire navigation.)
2. **Never `docker restart` the bun dev containers to "apply changes"** — they can crash-loop. Use `docker rm -f <name> && docker compose up -d <service>`.
3. **"No data in the UI" is almost never a code bug.** Check in order: API response → core logs → browser session (stale JWT) → `DEFAULT_TENANT_ID` in `.env` → schema drift via `prisma migrate diff`. Full playbook: `docs/KB_UNLOADED_CONFIG.md`.
4. **`prisma migrate status` does not detect drift** after a DB restore (the `_prisma_migrations` rows come with the dump). Only `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` tells the truth; expect `-- This is an empty migration.`
5. **Check the compose project before concluding edits aren't applying.** Containers created from another directory/project mount different volumes. `docker inspect <c> --format '{{.Config.Labels}}' | grep compose.project`.

## Environment

| Piece | Value |
|---|---|
| Console (Vite) | http://localhost:5173 |
| Core API (Next.js) | http://localhost:3000 |
| DB (host port) | localhost:5433 → container 5432 |
| DB URL (in-container) | `postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core` |
| DB volume | `klaoplatform_pgdata` (external — **do not delete**; holds live data) |
| Dev login | `admin@klao.app` / `Welcome2Ignite` |

## Key Commands

```bash
docker compose up -d                 # start all (db, core, console)
docker logs sails-core --since 5m    # API logs ([CONFIG] lines show nav resolution)
docker exec sails-db psql -U postgres          # SQL shell
docker exec sails-core sh -c "cd packages/core && bun x prisma generate"
docker exec sails-core sh -c "cd packages/core && bun run cli tenant:list"
```

## Backup (standard procedure)

**When the user says "backup", always run:**

```bash
./scripts/backup-db.sh
```

This produces two timestamped files in `backups/`:
- `sails_schema_YYYYMMDD_HHMMSS.sql` — structure (schemas, tables, indexes, FKs, RLS policies)
- `sails_data_YYYYMMDD_HHMMSS.sql` — data (COPY, with trigger guards for self-referencing FKs)

Never create ad-hoc dumps with `--create`/`--clean` (they emit `DROP DATABASE`, which breaks replay) and always strip `\restrict`/`\unrestrict` markers. Restore steps: `docs/KB_UNLOADED_CONFIG.md` § Restore.

## Architecture Pointers

- **Navigation is DB-driven**: `core.console_apps` + `core.console_menus` → `GET /api/console/config` → `ConsoleContext` → `Sidebar.tsx`. Menu items resolve to plugins via `componentKey` in `packages/console/src/features/admin/registry.tsx`. Mock data in `config/route.ts` (`getMockData`) is a fallback for empty DBs — seeing Dashboard/CRM in the UI means the DB query returned nothing.
- **Tenant data**: `tenant_{schema}` schemas with RLS policies; context injected via `SET LOCAL` in `TransactionContext`.
- **Zoning Multi-Tenancy Architecture**: Baseline deployment runs as **Zone 01** (`standalone` mode). The platform is architected for **Cell-Based Zoning**, allowing deployment across multiple isolated database servers/clouds with a Global Control Plane and Super Admin War Room. See `docs/ZONING_ARCHITECTURE.md`.
- **Standards**: `docs/DEVELOPMENT_STANDARDS.md` (security pipeline, schema rules — metadata tables must have `is_system`).
- **Docs**: `docs/` — see especially `docs/ZONING_ARCHITECTURE.md` (zoning model), `docs/KB_UNLOADED_CONFIG.md` (diagnosis playbook) and `docs/CREATE_APP_NAV.md`.

## When You Change Things
- New/changed Prisma models → create migration or document manual DDL; verify zero drift with `migrate diff`.
- New admin menu/plugin → register `componentKey` in `registry.tsx`, seed menu via `TenantProvisioner.ts` (new tenants) **and** provide a script/SQL for existing tenants.
- Touching RLS policies → check every column referenced in joined tables (new columns can make unqualified refs ambiguous).
