# KLAO Core — Data Access & Security Roadmap

This document outlines the strategic security implementation plan for **KLAO** (`klao.app`), a No-Code CRM Platform.

**Strategic Architecture:**
1. **KLAO Core**: Headless Backend API (Owned by **Backend Engineer**).
2. **KLAO Console**: Frontend UI (Owned by **Frontend Engineer**).
3. **KLAO Shared**: Type Contracts & Shared Models (Owned by **Platform Architect**).
4. **KLAO Database**: Metadata & Dynamic Schemas (Owned by **Database Engineer**).
5. **KLAO QA**: Automated Verification Suite (Owned by **QA Tester**).

## Identity & Access Management (IAM)

| Phase | Status | Scope |
|---|---|---|
| **A — Foundation** | ✅ Complete | JWT session, RLS, RBAC, audit logs, Core-Console auth bridge, Prisma schema migration |
| **B — Enterprise Federation** | 🟡 In Progress | OAuth 2.0 / OIDC: Microsoft Entra ID (Azure AD), Google Workspace, SSO domain discovery |
| **C — Advanced Governance** | 🔲 Pending | Field-Level Security (FLS), auth change audit logs |
| **D — B2B2C** | 🔲 Pending | Client Portals with separate identity silos |

### Phase A — Completed Details
- ✅ **Authentication**: `src/lib/auth/session.ts` — Resolved by **Backend Engineer**.
- ✅ **Metadata Management**: `prisma/schema.prisma` — Managed by **Database Engineer**.
- ✅ **Context Injection**: `TransactionContext.ts` — Owned by **Database Engineer**; injects `SET LOCAL app.current_user_id` / `app.current_tenant_id`.
- ✅ **Access Control**: `AccessGuard.ts` — Implemented by **Backend Engineer**; Object-Level RBAC via `object_permissions`.
- ✅ **Atomic Auditing**: `QueryLayer.ts` — Orchestrated by **Backend Engineer**; session → RBAC → RLS → Audit Log (atomic).
- ✅ **Security Verification**: `test-security.ts` — 8-scenario suite maintained by **QA Tester** (all passing).

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

---

## Phase 5: Enterprise SSO & Tenant Auto-Routing (🔲 Pending)
**Vision:** Enable seamless onboarding for enterprise clients by mapping Google Workspace domains to specific Tenants.

- **Domain Matching**: Automatically route users to the correct Tenant based on their email domain (e.g., @acme.com).
- **Just-in-Time (JIT) Provisioning**: Automatically create a `core.users` record and assign the `MEMBER` role upon first successful Google login if the domain matches a whitelisted tenant.
- **Security**: Strictly deny access to the platform if a user's Google domain is not associated with any active tenant.
