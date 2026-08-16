# SAILS Platform — Agent Guide

Multi-tenant, schema-per-tenant platform. Monorepo: `packages/core` (Next.js API + Prisma + engine), `packages/console` (Vite React admin UI), `packages/shared` (types).

## Golden Rules (read first — these prevent the most common AI-caused outages)

1. **Never put writes/seeding/"auto-repair" inside runtime API GET handlers.** Schema and menu changes go in migrations or one-off scripts. (This exact mistake once blanked the entire navigation.)
2. **Never `docker restart` the bun dev containers to "apply changes"** — they can crash-loop. Use `docker rm -f <name> && docker compose up -d <service>`.
3. **"No data in the UI" is almost never a code bug.** Check in order: API response → core logs → browser session (stale JWT) → `DEFAULT_TENANT_ID` in `.env` → schema drift via `prisma migrate diff`. Full playbook: `docs/KB_UNLOADED_CONFIG.md`.
4. **`prisma migrate status` does not detect drift** after a DB restore (the `_prisma_migrations` rows come with the dump). Only `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` tells the truth; expect `-- This is an empty migration.`
5. **Check the compose project before concluding edits aren't applying.** Containers created from another directory/project mount different volumes. `docker inspect <c> --format '{{.Config.Labels}}' | grep compose.project`.
6. **`packages/core/tests/*` (test-engine, test-security, test-validation, test-provisioner) are DESTRUCTIVE** — their CLEANUP phases run `tenant.deleteMany({})` / `user.deleteMany({})` on the LIVE dev DB. They require `ALLOW_DESTRUCTIVE_TESTS=true` to run, preventing accidental execution against non-test databases.
7. **Never run `DISCARD ALL` in PostgreSQL connection transaction wrappers.** `DISCARD ALL` kills prepared statements and degrades PgBouncer transaction pooling. Use targeted `RESET ROLE` and rely on `SET LOCAL` automatic cleanup.
8. **Always use `configCache` for frequent metadata & permission checks** (`resolveTable`, `AccessGuard`) to avoid redundant relational Prisma joins before every tenant data transaction.
9. **Never execute concurrent queries on a single `pg` connection socket via `Promise.all`**. Run `dataSQL` and `countSQL` sequentially with `await` to prevent connection pipeline lock contention.
10. **Always deduplicate cell-level API requests (`fetchCached` / in-flight Promise)**. Never dispatch per-row un-deduplicated API fetches in table cell renderers (`UserControl`, lookups) to prevent "Thundering Herd" API bursts.
11. **Never declare React hooks below early conditional returns**. All hooks (`useState`, `useMemo`, `useEffect`, `useCallback`) MUST be called at the unconditional top-level of the component to prevent React Hook Ordering crashes on state/loading transitions.

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

## Expression (Calculated) Fields

- `logicalType: 'expression'` stores a **JSONata formula** in `fields.config.expression` + `config.resultType` (number/text/boolean/date → NUMERIC/VARCHAR/BOOLEAN/TIMESTAMPTZ column).
- Computed **on save** in `QueryLayer` (`ComputedFields.ts`); client-supplied values are always stripped/overridden. Same-record formulas recompute synchronously; **cross-model** references (via relation fields) recompute asynchronously.
- Cross-model recompute: `core.enqueue_computed_change()` triggers on referenced tables enqueue into `core.computed_recompute_queue`; `ComputedRecomputeWorker.ts` (started in `plugins/init.ts`, like the scheduler) drains it as table owner. `config.dependencies` + `config.referencedFields` are derived from the JSONata AST at field save (`analyzeExpression`) and drive trigger lifecycle + delete guards. Queue rows are deduped at DRAIN time (never at trigger time — trigger-time dedupe raced the worker and dropped rapid writes).
- **First-party function library** (`packages/shared/src/expressionFunctions.ts`, registered in `evaluateJsonata` + the editor's Test runner): date/time formulas missing from JSONata core — `$addDays/$addMonths/$addYears`, `$startOfDay/$startOfMonth/$startOfWeek/...`, `$diffDays/$diffHours/$diffMonths/$diffYears/$ageYears`, `$year/$month/$weekday/$weekdayName/...`, `$formatDate/$parseDate` (yyyy MM dd HH mm MMM ddd tokens), `$today`. Invalid input → NULL, never throws.
- **Rollup**: `$sum($related('child_table', 'fk_field').amount)` aggregates child rows (RLS-scoped). `analyzeExpression` records it as a `reverse: true` dependency; `core.enqueue_computed_reverse_change()` triggers on the child table recompute the parent (worker, sub-second). `$sum` of an empty child set is NULL (JSONata semantics).
- Rules: expressions cannot reference other Expression fields (v1); deleting a field referenced by a formula is blocked; a failing expression stores NULL (never blocks the write); related-record staleness is eventually consistent (worker, sub-second).
- **Live list aggregates**: `GET /api/dynamic/[tableName]?aggregates=[{fieldId,aggregate}]` (sum/avg/min/max/count) computes SQL aggregation inside the same RLS transaction + filters as the list; the list engine renders a totals row. `config.summaryFields` (with `aggregate`) drives the Summary Panel in LayoutStudio.
- Safe regression tests: `packages/core/tests/test-expression-fields.ts`, `test-layout-prune.ts`, `test-expression-date-aggregate.ts` (all self-contained — create and drop their own throwaway tables; unlike the other destructive tests they do NOT wipe live data).

## Localization (user-built content)

- **Two layers**: platform chrome uses i18next static locale files (`packages/console/src/locales/{en,th}`) with `safeT`; user-built labels (table/field names, section titles, action/event labels, message boxes, validation messages) use `LocalizedText` (`packages/shared/src/localization.ts`) — a plain string (legacy/default) or `{ locale: text }`. Resolve via `localize(value, locale, defaultLocale)` (locale → tenant default → en → first → plain).
- **Locale chain**: `users.locale` → `company_profiles.default_locale` → `en`, resolved in the NextAuth jwt callback (`authOptions.ts`) and carried on the session (`SessionContext.locale`); the console adopts it via `LocaleSync` (`I18nContext`) unless the user manually switched (localStorage override `sails.locale.override`). Tenant default also exposed in `/api/console/config` (`data.defaultLocale`).
- **Storage**: optional `*_i18n` JSON columns (tables/fields name+description, validation_rules error_message, console_apps name+description, console_menus label) + JSON objects inside layout/workflow config labels. Metadata routes/TranslatorLayer accept and persist them.
- **Editing**: `TranslatableInput` component (input + globe badge → per-locale popover; `setLocalizedText` collapses to a plain string when only `en` remains). Editors wired so far: ObjectManager table/field names (create/edit), AdminAppManager app/menu labels, Notification Message modal title/message/button labels.
- **Rendering**: `useLocalizedText()` hook (client) + `localizeFallback(staticKey, value)` for menus/apps (static key wins). Wired: Sidebar/Topbar, list column headers (`resolveLabel`), `DetailFieldLabel`, DynamicDetailPage section titles + action labels, LayoutStudio preview (section titles, block/column/related-list labels). Server-side: form-event route + notification_message plugin localize by session locale (pre-validation messages, message-box payloads).
- Not yet localized (Phase 4): workflow studio labels, email/bell notifications by recipient locale, select-option labels.
