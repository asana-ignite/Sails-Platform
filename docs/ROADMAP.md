# SAILS — Enterprise CRM: Security & Configuration Roadmap

This document outlines the strategic security and configuration roadmap for **SAILS**, an enterprise-grade CRM application built on a flexible, configuration-first architecture.

**Strategic Architecture:**
1. **SAILS Core**: Headless Backend API (Owned by **Backend Engineer**).
2. **SAILS Console**: Frontend UI (Owned by **Frontend Engineer**).
3. **SAILS Shared**: Type Contracts & Shared Models (Owned by **Platform Architect**).
4. **SAILS Database**: Metadata & Dynamic Schemas (Owned by **Database Engineer**).
5. **SAILS QA**: Automated Verification Suite (Owned by **QA Tester**).

## Identity & Access Management (IAM)

| Phase | Status | Scope |
|---|---|---|
| **A — Foundation** | ✅ Complete | JWT session, RLS, RBAC, audit logs, Core-Console auth bridge, Prisma schema migration |
| **B — Enterprise Federation** | 🟡 In Progress | OAuth 2.0 / OIDC: Google Workspace Domain Mapping, SSO discovery for enterprise domains |
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
**Goal:** Secure data via Object-Level restrictions and native PostgreSQL RLS for enterprise teams.

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
> Constraints bind both SAILS Console (UI) and SAILS Core (API).

Please see [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md) for the consolidated list of pre-declared constraints regarding client-side ID generation, IndexedDB usage, and SyncQueues.

---

## Phase 5: Google Workspace & Domain Routing (🔲 Pending)
**Vision:** Enable seamless onboarding for organizational staff by mapping Google Workspace domains.

- **Domain Matching**: Automatically route users to the correct internal Tenant based on their @igniteidea.ai email domain.
- **Just-in-Time (JIT) Provisioning**: Automatically create a `core.users` record and assign appropriate roles upon first successful Google login.
- **Security**: Strictly deny access to the platform if a user's Google domain is not recognized.

---

## Topic Roadmaps

- **Transaction & Multi-Tenant Resilience** → [TRANSACTION_RESILIENCE_ROADMAP.md](TRANSACTION_RESILIENCE_ROADMAP.md) — network-loss idempotency, transactional atomicity, bulk data API, and multi-tenant concurrency hardening.
- **Advanced Analytics** → [ANALYTICS_ROADMAP.md](ANALYTICS_ROADMAP.md)
- **Plugin Platform** → [PLUGIN_PLATFORM_ROADMAP.md](PLUGIN_PLATFORM_ROADMAP.md)

---

## Phase 6: Cellular Zoning Architecture & Super Admin War Room (🔲 Planned)
**Vision:** Evolve SAILS into a Cell-Based Zoning Architecture with global domain routing, dynamic DSN pool resolution, and unified War Room telemetry.

- **Phase 6A — Global Control Plane**: Deploy lightweight global registry (`sails_global_master`) mapping `tenantId -> zoneId -> zone_api_url`.
- **Phase 6B — Dynamic DSN Pool Router**: Introduce `TenantConnectionManager` in Core to dynamically route queries across isolated Zone databases.
- **Phase 6C — Zone Telemetry API**: Expose `GET /api/zone/health` on Core API containers for container CPU/RAM and database connection monitoring.
- **Phase 6D — Super Admin War Room**: Build Console plugin for real-time monitoring of all Zones and tenants across AWS, Azure, and Local instances.
- **Phase 6E — Zero-Downtime Tenant Relocation**: Build `bun run cli tenant:relocate` script to move tenant schemas across Zone databases with sequence continuation.


