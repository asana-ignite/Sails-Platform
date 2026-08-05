# SAILS — Advanced Analytics Roadmap

**Owner:** Platform Architect / Backend Engineer (query engine), Frontend Engineer (dashboards), Database Engineer (metadata + rollups), QA Tester (verification).

This document defines the strategic roadmap for **Advanced Analytics** on the SAILS platform. Analytics is delivered as a **metadata-driven, per-tenant** capability: every query flows through the existing RLS/security pipeline, and dashboards are configured visually with no code.

## Guiding Constraints (non-negotiable)

1. **RLS is absolute.** Every analytics query must execute inside `TransactionContext` (per-tenant `SET LOCAL` context). Analytics can **never** run as `postgres`, never bypass `AccessGuard`, and never escape the tenant schema.
2. **Read-only.** Analytics endpoints are strictly read-only. No writes, seeding, or "auto-repair" inside runtime API GET handlers (see `AGENTS.md` golden rule #1).
3. **No external OLAP engine.** Postgres is the analytics engine. No DuckDB/ClickHouse/etc. — secondary stores would duplicate tenant data outside the RLS-protected database. The only acceptable extensions are **Postgres-native** (TimescaleDB, PostgresML) because they keep queries inside the same RLS context.
4. **Whitelist, never freeform.** Aggregations, expressions, and date buckets are compile-time whitelisted. Field names are resolved against `core.fields` metadata. Raw SQL from users or the LLM is never accepted.
5. **Drift-free schema.** New metadata models ship with Prisma migrations; verify zero drift via `prisma migrate diff`.
6. **Destructive tests stay off the live DB.** New analytics tests are non-destructive and run only on a throwaway database (see `AGENTS.md` golden rule #6).

## Architecture Decision: Why Postgres, Not DuckDB/ClickHouse

| Consideration | Postgres (chosen) | DuckDB / ClickHouse (rejected) |
|---|---|---|
| Tenant isolation | RLS via `TransactionContext` applies natively | Data must be exported out of Postgres → RLS pipeline bypassed |
| Scale fit | Handles CRM-scale tenants (100k–low millions of rows) | Justified only at billions of rows / heavy OLAP scans |
| Consistency | Single source of truth, zero sync machinery | Requires ETL pipeline to keep secondary store in sync |
| Extensibility | TimescaleDB (time-series), PostgresML (ML) as in-DB extensions | Separate runtime + new failure modes |
| Revisit trigger | — | Massive scale, or cross-tenant platform-level analytics (Zone War Room, `ROADMAP.md` Phase 6) |

## Phase A — Analytics Query Engine (Core) ✅ Definition Complete

**Goal:** A secure aggregation layer that compiles a JSON report spec into safe SQL, executed under RLS.

### A1. Shared contract — `packages/shared/src/index.ts`
- New types: `AnalyticsQuerySpec` (dataset, `dimensions[]`, `measures[]`, `filters[]`, `granularity`, `sort`, `limit`), `AnalyticsDashboard`, `AnalyticsReport`, `ChartType`, `MeasureDef`, `DimensionDef`, `AnalyticsFilter`.
- New capabilities in `packages/shared/src/permissions.ts` `SYSTEM_PERMISSION_REGISTRY`:
  - `analytics.dashboards.view` — View dashboards and run analytics queries.
  - `analytics.dashboards.manage` — Create, edit, and delete dashboards/reports.

### A2. Query builder — new `packages/core/src/core/engine/AnalyticsQueryBuilder.ts`
- Compiles a validated `AnalyticsQuerySpec` → parameterized SQL via `pg-format` (same injection discipline as `AlchemaCore.ts`).
- **Aggregation whitelist**: `COUNT`, `COUNT(DISTINCT x)`, `SUM`, `AVG`, `MIN`, `MAX`.
- **Date buckets**: day, week, month, quarter, year (SQL `date_trunc` / `to_char`).
- **Field resolution** against `core.fields` metadata: spec references logical field names; builder maps to real columns and rejects unknown fields. This single choke point validates both user and LLM input.
- Execution through `QueryLayer.executeSecureQuery` (`QueryLayer.ts`) so `AccessGuard` + RLS apply exactly like normal CRUD.

### A3. Metadata models — `packages/core/prisma/schema.prisma` (`@@schema("core")`, mirroring `ConsoleApp`)
- `AnalyticsDashboard` — id, tenantId, name, slug, icon, `layout Json`, order, isSystem, requiredCapability, timestamps.
- `AnalyticsReport` — id, tenantId, dashboardId, title, chartType, dataset, `dimensions/measures Json`, granularity, `filters Json`, sort, limit, requiredCapability, order.
- Ship via `prisma migrate dev --name analytics_metadata`; verify zero drift.

### A4. API routes — `packages/core/src/app/api/analytics/`
- `POST /api/analytics/query` — executes a report spec; returns rows + meta. Read-only.
- `POST /api/analytics/dashboards` / `GET` / `PATCH` / `DELETE` (incl. `[id]`) — dashboard CRUD.
- `POST /api/analytics/reports` / `GET` / `PATCH` / `DELETE` — report CRUD.
- All endpoints enforce capability + RLS; dashboard/report reads are tenant-scoped.

### A5. Provisioning & seeding
- Extend `TenantProvisioner.ts` to seed a default "Analytics" app + dashboard for new tenants.
- Provide a one-off script/SQL for existing tenants (per `AGENTS.md` rule — never seed via runtime GET).

## Phase B — Dashboards & Charting (Console)

**Goal:** DB-driven, drag-and-drop dashboards rendered from `AnalyticsDashboard`/`AnalyticsReport` metadata.

- **Charting library**: add **`recharts`** (React 18-native, lightest dependency). Swap to Apache ECharts only if heatmap/pivot-complex visuals become a hard requirement.
- **`ChartRegistry.tsx`** — new `packages/console/src/features/charts/`; `componentKey` → lazy chart component (Line, Bar, Area, Pie, Funnel, StatCard, DataTable, KPI list). Same registry pattern as `features/admin/registry.tsx` and `features/widgets/registry.tsx`.
- **`AnalyticsDashboardPage.tsx`** — route `/dashboard/:slug`, DB-driven grid layout, global date-range filter, click-to-drill-down (appends filter → re-queries).
- **Ad-hoc Report Builder** — evolve the `FilterBuilder.tsx` component into a drag-drop dimensions/measures builder that emits a validated `AnalyticsQuerySpec`.
- **Wiring** — register menu items via `ConsoleMenu.componentKey` (`docs/CREATE_APP_NAV.md` payload pattern); gate on `analytics.dashboards.*`; extend `ExportCsvButton` to report results.

## Phase C — Performance & Materialization

- Targeted Postgres indexes on group-by/date columns (tenant schemas already index `created_at DESC`).
- Per-tenant **materialized rollup tables** wrapped in **RLS security views** (materialized views bypass RLS — wrapping is mandatory). Refresh via scheduled job only, never inside a GET handler.
- Revisit only when a tenant's volume outgrows live aggregation latency.

## Phase D — Tier 3: Forecasting & Natural-Language Querying

### D1. Forecasting / ML — `POST /api/analytics/forecast`
- **Recommended**: **PostgresML** extension (in-DB) — keeps tenant isolation within the database; models stored per tenant schema; predictions run under RLS.
- **Fallback**: Python FastAPI sidecar fed via the tenant-scoped export API (only if PostgresML deployment/licensing is a blocker).
- Start with time-series forecasting (linear/ARIMA-style) over existing date + measure data.

### D2. Natural-language querying — `POST /api/analytics/nl-query`
- LLM converts natural language → `AnalyticsQuerySpec` (**JSON, never raw SQL**).
- Output **must** pass the Phase A2 validator before compilation.
- Console: NL input on dashboards with the generated spec surfaced for auditability.

## Acceptance Criteria per Phase

| Phase | Definition of Done |
|---|---|
| A | Aggregation endpoint returns correct, RLS-filtered results; injection attempts rejected; capabilities enforced |
| B | DB-driven dashboard renders charts from metadata; drill-down + date-range work; no static hardcoding |
| C | Rollup views refresh on schedule; reported query latency within target |
| D1 | Forecast endpoint returns model + prediction series under RLS |
| D2 | NL query produces validated spec; malformed/unsafe LLM output blocked |

## Verification

- **New non-destructive test suite** `packages/core/tests/test-analytics.ts` (run only on throwaway DB):
  - RLS leakage — tenant A cannot observe tenant B data.
  - Aggregation correctness vs. known fixtures.
  - Injection attempts (arbitrary SQL in spec/filters) rejected.
  - Capability gating — users without `analytics.dashboards.view` denied.
  - NL-spec validation — LLM-style malformed/unsafe input rejected.
- Manual: `docker logs sails-core` `[CONFIG]` lines confirm dashboard nav resolution; browser session valid.

## Delivery Order

1. Phase A1–A4 (contract → builder → models → API) + `test-analytics.ts`
2. Phase B1–B3 (recharts → registry → dashboard page) + A5/B5 wiring
3. Phase B4 (report builder) → Phase C → Phase D
