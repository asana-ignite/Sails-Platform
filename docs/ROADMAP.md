# KLAO Core — Data Access & Security Roadmap

This document outlines the strategic security implementation plan for **KLAO** (`klao.app`), a No-Code CRM Platform.

**Strategic Architecture:**
1. **KLAO Core**: Headless Backend API (Server-side engine).
2. **KLAO Console**: Frontend UI (PWA, ready for offline usage).
3. **KLAO Admin (Strategic)**: Isolated CLI/Scripts for sensitive operations (tenant removal, global cleanup) — restricted to internal VPN/IP.

## Identity & Access Management (IAM)

| Phase | Status | Scope |
|---|---|---|
| **A — Foundation** | ✅ Complete | JWT session, RLS, RBAC, audit logs, Core-Console auth bridge, Prisma schema migration |
| **B — Enterprise Federation** | 🔲 Pending | OAuth 2.0 / OIDC: Microsoft Entra ID (Azure AD), Google Workspace, SSO domain discovery |
| **C — Advanced Governance** | 🔲 Pending | Field-Level Security (FLS), auth change audit logs |
| **D — B2B2C** | 🔲 Pending | Client Portals with separate identity silos |

### Phase A — Completed Details
- ✅ `src/lib/auth/session.ts` — lazy-loads `next-auth` (never fails in CLI/Docker); supports `TEST_SESSION_JSON` env-var override for integration tests.
- ✅ `prisma/schema.prisma` — all 10 models in `@@schema("core")`. `User` extended with `tenantId`, `role`, `teamId`. `Account`, `Session`, `VerificationToken` added for NextAuth `PrismaAdapter`. Migration `20260502093918_auth_schema_core` applied.
- ✅ `TransactionContext.ts` — injects `SET LOCAL app.current_user_id` / `app.current_tenant_id`. Fixed `resolvedRole` hoisting bug.
- ✅ `AccessGuard.ts` — SUPER_ADMIN fast-path; Object-Level RBAC via `object_permissions`.
- ✅ `QueryLayer.ts` — session resolved once per request → AccessGuard → TransactionContext → Audit Log (atomic). Fixed `executeSecureQuery` callback wiring bug.
- ✅ `test-security.ts` — 8-scenario integration suite (all passing): no-session, SUPER_ADMIN fast-path, no-team, no-permission, wrong action, cross-tenant RLS, audit atomicity, and **Team Queue (Shared Ownership)**.

---

## Phase 1: Foundation & MVP (✅ Complete)
**Goal:** Secure data via Object-Level restrictions and native PostgreSQL RLS.

- **Multi-Team Membership:** N:M relationship via `UserTeam` join table; permissions aggregated across all teams.
- **Active Team Context:** `app.current_team_id` injected into transactions to support shared ownership.
- **Team-Based Ownership:** `owner_team_id` column in dynamic tables allows records to be shared within a team.
- **Enterprise Hierarchy:** Visibility flows upward via `parent_id` for both individual and team-owned records.
- **Hardened Isolation:** RLS policies explicitly validate tenant boundaries for all administrative and hierarchical checks.

---

## Phase 2: Granular Control & Sharing (🔲 Pending — DO NOT IMPLEMENT YET)
- Field-Level Security: Visible / Read-Only / Hidden per Team — implemented via Query Layer filtering, NOT PostgreSQL Column-Level Grants.
- Manual Sharing: `RecordShares` intersection table blended into RLS policies.
- System Permissions: Guards for mass Export and Mass Delete operations.

---

## Phase 3: Advanced Automation (🔲 Pending — DO NOT IMPLEMENT YET)
- Criteria-Based Sharing Rules (e.g., `Region = "North"` → grant team read access).
- API token and Webhook controls per Team.

---

## Phase 4: PWA — Offline-First (🔲 Pending — DO NOT IMPLEMENT YET)
> Constraints bind both KLAO Console (UI) and KLAO Core (API).

| Constraint | Rule |
|---|---|
| **Primary Keys** | Client generates UUIDv4 before saving to IndexedDB. DB must accept client-supplied IDs. |
| **`updatedAt`** | Must be writable by the client during SyncQueue flush. |
| **Idempotent CREATE** | Inserting a record whose UUID already exists → no-op, not an error. |
| **Conflict Resolution** | Last Write Wins: `clientUpdatedAt > serverUpdatedAt` → apply; otherwise → reject + return server state. |
| **SyncQueue** | Offline mutations queued in IndexedDB, flushed via Background Sync API (Service Worker). |
