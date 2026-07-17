# KLAO — Internal Data Access & Security Roadmap

This document outlines the strategic security implementation plan for **KLAO** (Ignite Idea Operating System).

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
| **B — Enterprise Federation** | 🟡 In Progress | OAuth 2.0 / OIDC: Google Workspace Domain Mapping, SSO discovery for Ignite Idea domains |
| **C — Advanced Governance** | 🔲 Pending | Field-Level Security (FLS) for sensitive financial/sales data |
| **D — Module Expansion** | 🔲 Pending | Dedicated modules for Timesheets and Case Management |

### Phase A — Completed Details
- ✅ **Authentication**: `src/lib/auth/session.ts` — Resolved by **Backend Engineer**.
- ✅ **Metadata Management**: `prisma/schema.prisma` — Managed by **Database Engineer**.
- ✅ **Context Injection**: `TransactionContext.ts` — Owned by **Database Engineer**; injects `SET LOCAL app.current_user_id` / `app.current_tenant_id`.
- ✅ **Access Control**: `AccessGuard.ts` — Implemented by **Backend Engineer**; Object-Level RBAC via `object_permissions`.
- ✅ **Atomic Auditing**: `QueryLayer.ts` — Orchestrated by **Backend Engineer**; session → RBAC → RLS → Audit Log (atomic).
- ✅ **Security Verification**: `test-security.ts` — 8-scenario suite maintained by **QA Tester** (all passing).

---

## Phase 1: Foundation & MVP (✅ Complete)
**Goal:** Secure data via Object-Level restrictions and native PostgreSQL RLS for internal Ignite Idea teams.

- **Multi-Team Membership:** N:M relationship via `UserTeam` join table; permissions aggregated across all teams.
- **Active Team Context:** `app.current_team_id` injected into transactions to support shared ownership.
- **Team-Based Ownership:** `owner_team_id` column in dynamic tables allows records to be shared within a team.
- **Internal Hierarchy:** Visibility flows upward via `parent_id` for both individual and team-owned records (Sales Rep -> Manager).
- **Hardened Isolation:** RLS policies explicitly validate tenant boundaries for all administrative and hierarchical checks.

---

## Phase 2: Internal Ops & Sharing (🔲 Pending — DO NOT IMPLEMENT YET)
- Field-Level Security: Visible / Read-Only / Hidden per Team — implemented via Query Layer filtering, NOT PostgreSQL Column-Level Grants.
- Manual Sharing: `RecordShares` intersection table blended into RLS policies for cross-project collaboration.
- System Permissions: Guards for mass Export and Mass Delete operations.

---

## Phase 3: Project & Timesheet Automation (🔲 Pending — DO NOT IMPLEMENT YET)
- Criteria-Based Sharing Rules (e.g., `Project = "Confidential"` → restrict team access).
- Automatic Timesheet generation from Project tasks.
- API token and Webhook controls per Internal Team.

---

## Phase 4: PWA — Offline-First Field Ops (🔲 Pending — DO NOT IMPLEMENT YET)
> Constraints bind both KLAO Console (UI) and KLAO Core (API).

| Constraint | Rule |
|---|---|
| **Primary Keys** | Client generates UUIDv4 before saving to IndexedDB. DB must accept client-supplied IDs. |
| **`updatedAt`** | Must be writable by the client during SyncQueue flush. |
| **Idempotent CREATE** | Inserting a record whose UUID already exists → no-op, not an error. |
| **Conflict Resolution** | Last Write Wins: `clientUpdatedAt > serverUpdatedAt` → apply; otherwise → reject + return server state. |
| **SyncQueue** | Offline mutations queued in IndexedDB, flushed via Background Sync API (Service Worker). |

---

## Phase 5: Google Workspace & Domain Routing (🔲 Pending)
**Vision:** Enable seamless onboarding for Ignite Idea staff by mapping Google Workspace domains.

- **Domain Matching**: Automatically route users to the correct internal Tenant based on their @igniteidea.ai email domain.
- **Just-in-Time (JIT) Provisioning**: Automatically create a `core.users` record and assign appropriate roles upon first successful Google login.
- **Security**: Strictly deny access to the platform if a user's Google domain is not recognized.

