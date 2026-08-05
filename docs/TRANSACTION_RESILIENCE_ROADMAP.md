# SAILS — Transaction & Multi-Tenant Resilience Roadmap

**Owner:** Database Engineer (pool/transactions/RLS), Backend Engineer (idempotency + bulk API), Platform Architect (shared contracts), Frontend Engineer (client retry), QA Tester (verification).

This document defines the roadmap for making SAILS resilient to two real-world failure classes: **(1) network loss during writes** and **(2) massive data manipulation by multiple tenants concurrently**. It fixes transactional gaps, adds idempotency, and hardens the shared connection pool / audit path that all tenants contend on.

## Current-State Snapshot (audit findings)

| Area | Today | Gap |
|---|---|---|
| Dynamic CRUD (`QueryLayer` + `TransactionContext`) | Real `BEGIN→SET LOCAL(RLS)→COMMIT` per op, `ROLLBACK` on error (`TransactionContext.ts:35-70`) | Catch calls `ROLLBACK` on a dead connection, masking the original error |
| Prisma routes (teams/users/positions/metadata/console/provision) | No explicit transactions — each `db.create/upsert` commits independently | Multi-step handlers (e.g. team-member loop `teams/[id]/members/route.ts:31-49`) are non-atomic |
| Audit logging (`QueryLayer.ts:173,249,309`) | Fire-and-forget `pool.query` **after** COMMIT | Comment claims "atomic" but audit can be lost while data commits |
| Client→API loss after commit | — | No idempotency anywhere (0 matches in repo) → retries create **duplicate records** |
| Connection pool (`lib/knex.ts`, `lib/db.ts`) | Default `pg` Pool, no `max`/timeouts; expects `pgbouncer=true&connection_limit=20` in prod | Every transaction holds one connection for its full duration; pool exhausts under multi-tenant load → timeouts that look like "network lost" |
| Timeouts | None: no `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` | One slow tenant can hold locks/connections indefinitely |
| Bulk writes | None — massive manipulation = N sequential `/api/dynamic` POSTs (N transactions + N audit rows) | No chunking, no resume, no batch audit |
| Client (`packages/console/src/api/client.ts`) | In-flight dedup only; no timeout/retry | Hung requests leave UI loading forever |

## Guiding Constraints (non-negotiable)

1. **RLS is absolute.** Every data query executes inside `TransactionContext` (per-tenant `SET LOCAL`). Nothing runs as `postgres`; nothing bypasses `AccessGuard`. (Applies to bulk endpoints too.)
2. **No writes/seeding inside runtime GET handlers** (AGENTS.md golden rule #1). Schema/menu changes stay in migrations/scripts.
3. **Idempotency is additive.** No `Idempotency-Key` header → behavior identical to today. Existing clients unaffected.
4. **Short transactions.** Single-op audit stays in-transaction; **bulk uses batch-level audit** so the shared `core.data_audit_logs` table never becomes the contention point.
5. **Fairness.** Per-tenant concurrency limits ensure one tenant's bulk job cannot starve the shared pool.
6. **Drift-free schema.** New metadata models ship via Prisma migration; verify zero drift with `prisma migrate diff` (AGENTS.md rule 4).
7. **Destructive tests stay off the live DB** (AGENTS.md rule 6) — concurrency/bulk tests run only on a throwaway database.

---

## Phase A — Server-Side Idempotency (all write routes)

**Goal:** make every write safe to retry; a replayed request returns the original response instead of duplicating.

- **A1. Model** — new `IdempotencyKey` in `packages/core/prisma/schema.prisma` (`@@schema("core")`): `key`, `tenantId`, `method`, `path`, `requestHash` (sha256), `status` (`in_progress`/`completed`), `responseStatus`, `responseBody Json`, `expiresAt`. `@@unique([key, tenantId])`, index on `expiresAt`. Hand-written migration (repo style) → zero drift.
- **A2. Service** — new `packages/core/src/core/engine/IdempotencyService.ts` → `executeWithIdempotency(req, run)`: no key → run directly; key → insert row (unique key+tenant); on unique-violation replay a `completed` result or return `409 Retry-After` while `in_progress`; same key + different hash → `422`.
- **A3. Wrap every write handler**:
  - Dynamic CRUD: `POST/PATCH/DELETE` in `packages/core/src/app/api/dynamic/[tableName]/route.ts:43,296,340`.
  - Prisma routes: teams (`route.ts` + `[id]`), members (`[id]/members`, `[id]/members/[userId]`), positions + slots, users, metadata objects/fields/reset-sequence, console apps/menus/layouts/widgets/company-profile, `auth/register`, tenant `provision`.
- **A4. Housekeeping** — probabilistic TTL cleanup (`DELETE … WHERE expires_at < now() LIMIT 100`) on the write path; no pg_cron dependency in dev.

## Phase B — True Atomicity

- **B1. Audit inside the transaction** — move the audit INSERT into the same `TransactionContext` client in `QueryLayer.ts` insert/update/delete; remove the fire-and-forget `pool.query`. **Verify RLS on `core.data_audit_logs` under `rls_user`** — if blocked (the likely reason it was pushed out), elevate role *within* the same transaction.
- **B2. Wrap multi-record loops** — team-members upsert loop in `db.$transaction`, folding its `SchemaLogger.logSystemEvent` into the same tx.
- **B3. Harden `TransactionContext`** (`TransactionContext.ts:68-81`) — guard `ROLLBACK`/`RESET`/`release` in try/catch so a dead connection never masks the original error.

## Phase C — Client Auto-Retry Reusing the Same Key

- Extend `packages/console/src/api/client.ts` with `clientRequest()` for writes: UUID `Idempotency-Key` per logical action (retained across retries), 15s `AbortController` timeout, up to 3 backoff retries on network-error/5xx/`409` only (never on 4xx validation).
- Migrate orchestrated write flows (e.g. `AdminTeamManager.tsx` member+positions) to `clientRequest`; GET `fetchCached` unchanged.

## Phase D — Multi-Tenant Concurrency & Massive Data Manipulation

- **D1. Connection & timeout hardening**:
  - Explicit pool config in `lib/knex.ts`/`lib/db.ts`: `max` (respecting `pgbouncer=true&connection_limit=20`), `connectionTimeoutMillis` (~5s), `idleTimeoutMillis`.
  - In `TransactionContext`, after `BEGIN`, `SET LOCAL` for `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` (transaction-scoped, auto-reset).
  - **Deadlock retry** on SQLSTATE `40P01`/`40001` in QueryLayer + bulk path (deadlocks rise when many tenants hit shared `core` tables).
- **D2. Bulk API** — new `POST/PATCH/DELETE /api/dynamic/[tableName]/bulk`:
  - Chunked transactions (500–1000 rows/chunk), each in its own `TransactionContext` (RLS via `SET LOCAL`), **multi-row INSERT** via `pg-format` `%L` over array-of-arrays (not row-by-row). COPY as a future fast-path.
  - **Per-chunk idempotency key** → resumable after network drop; replay continues from the last chunk.
  - **Batch-level audit** (one aggregated row per chunk) to keep the shared audit table fast (interacts with B1).
  - Per-row `validateRecord`/`sanitizeWritePayload`; per-row error report (bad rows skipped) with optional strict all-or-nothing mode.
- **D3. Fairness + observability**:
  - In-process per-tenant semaphore (max ~2 concurrent bulk jobs/tenant) around bulk endpoints.
  - Key TTL cleanup (from A4) + index sizing on the hot `idempotency_keys` table.
  - Transaction-duration logging in `TransactionContext`; `pg_stat_activity`-based health endpoint for lock/long-transaction visibility.

## Verification

- `prisma generate` + migration apply + zero-drift `prisma migrate diff`.
- Lint/typecheck in `packages/core` and `packages/console`.
- Manual: same `Idempotency-Key` twice → one row; drop-after-commit replay → same response; simulated bulk drop → resume via chunk key, no dupes; concurrent bulk from 2 tenants → no pool exhaustion/deadlock.

## Suggested Rollout Order

1. **Phase B3 + A (dynamic routes)** — harden txn, then idempotency on the highest-volume writes.
2. **Phase A (all Prisma routes)** — complete idempotency coverage.
3. **Phase C** — client auto-retry (consumes A).
4. **Phase B1/B2** — audit atomicity + Prisma loop transactions.
5. **Phase D1** — pool/timeout hardening (unlocks D2 safely).
6. **Phase D2** — bulk API.
7. **Phase D3** — fairness + housekeeping + observability.

## Open Items

- RLS posture on `core.data_audit_logs` under `rls_user` (drives B1 design).
- Whether `auth/register` + `provision` take idempotency keys (multi-step, external callers).
- Chunk size + per-tenant semaphore cap tuning at load-test time.
