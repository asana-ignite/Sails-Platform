# KLAO Core — Database Architecture

This document outlines the database architecture that powers **KLAO Core** (`klao.app`). To ensure true enterprise-grade multi-tenancy and security, the system enforces a strict logical boundary between system metadata and user data through schema segregation.

## 1. Schema Separation Strategy

The PostgreSQL database is divided into two distinct logical areas. The specific isolation model is governed by the `ConnectionManager` singleton, which supports two strategies:

| Strategy | Description | Status |
|---|---|---|
| `SCHEMA_PER_TENANT` | All tenants share one database, each with an isolated schema | ✅ Active |
| `DATABASE_PER_TENANT` | Each tenant gets a completely separate database | 🔮 Future-ready |

All services (`AlchemaCore`, `QueryLayer`, `TenantProvisioner`) resolve their database connections through the `ConnectionManager` instead of holding raw `Pool` references. This means migrating from schema-per-tenant to database-per-tenant requires changes ONLY inside `ConnectionManager.ts` — zero changes to business logic.

### `core` (The Metadata & Engine Schema)
The `core` schema is the highly protected central nervous system of the platform. Standard users *never* have direct read or write access to this schema. It is managed entirely by **Prisma** and contains:

| Category | Tables |
|---|---|
| **Auth / Identity** | `users`, `accounts`, `sessions`, `verification_tokens` |
| **RBAC** | `teams`, `object_permissions` |
| **Metadata** | `tenants`, `tables`, `fields`, `validation_rules` |
| **Console Metadata** | `console_apps`, `console_menus` |
| **Audit** | `audit_logs` |

> All `core` tables are declared with `@@schema("core")` in Prisma and are created under the migration `20260502093918_auth_schema_core`.

### `tenant_{schemaName}` (The Dynamic Data Schemas)
Every time a new Tenant signs up, `AlchemaCore.ts` generates a completely new, dedicated physical schema specifically for them (e.g., `tenant_acme_corp`).
- This physically isolates data from other tenants (no accidental data leakage).
- Standard users interact *only* with tables built dynamically inside their respective `tenant_*` schema.

## 2. Table Lifecycle & Dynamic DDL

When a user defines a new Table in the UI (e.g., "Leads"), the platform does NOT use a slow Entity-Attribute-Value (EAV) pattern. Instead:
1. `TranslatorLayer.ts` writes the blueprint into the `core.tables` metadata.
2. `AlchemaCore.ts` executes raw, sanitized SQL (`pg-format`) to physically create a true PostgreSQL table: `CREATE TABLE tenant_acme.leads (...)`.
3. Standard columns are strictly injected into every dynamic table:
   - `id` (UUID Primary Key)
   - `created_at`, `updated_at` (Timestamps)
   - `owner_id`, `created_by`, `updated_by` (Foreign Keys back to `core.users`)

## 3. Database Security & Transactions

### Row-Level Security (RLS)
The database enforces security at the engine level so that application code can never accidentally leak data.
When `AlchemaCore` creates a dynamic table (e.g., `tenant_acme.leads`), it permanently binds this RLS policy:
```sql
CREATE POLICY leads_owner_policy ON tenant_acme.leads FOR ALL USING (
    (SELECT view_all_data FROM core.object_permissions
     WHERE team_id = (SELECT team_id FROM core.users WHERE id = current_setting('app.current_user_id')::uuid)
       AND object_name = 'leads') = true
    OR owner_id = current_setting('app.current_user_id')::uuid
    OR owner_id IN (
        SELECT id FROM core.users WHERE team_id IN (
            SELECT id FROM core.teams
            WHERE parent_id = (
                SELECT team_id FROM core.users
                WHERE id = current_setting('app.current_user_id')::uuid
            )
        )
    )
);
```
**How it works:**
1. A user's request hits the API. `QueryLayer` resolves the Auth.js JWT session.
2. `TransactionContext` injects the user ID and tenant ID into the active PostgreSQL session via `SET LOCAL`:
   - `app.current_user_id` → used by RLS policies
   - `app.current_tenant_id` → used for audit log correlation
3. PostgreSQL evaluates the policy natively. It queries the `core` schema to check if the user's Team has `view_all_data`, if they explicitly own the row, or if they are higher up in the hierarchy than the owner. If none are true, the row is invisible.

> **Critical:** Non-superuser roles (e.g., `rls_user`) must be used in transactions for RLS to be enforced. Superuser connections bypass RLS at the PostgreSQL level.

### Atomic Audit Logging
`QueryLayer.ts` wraps all DML operations (Insert, Update, Delete). Whenever a dynamic row is mutated in a `tenant_*` schema, the `QueryLayer` captures `oldValues` and `newValues` and fires an `INSERT INTO core.audit_logs` *within the exact same PostgreSQL transaction*. If either the DML or the audit INSERT fails, the entire transaction rolls back cleanly. This atomicity is verified by `test-security.ts` Scenario 7.

### Session Mock for Testing
`session.ts` supports a `TEST_SESSION_JSON` environment variable override. When set, it bypasses `getServerSession()` entirely (which requires a Next.js HTTP context) and returns the injected session object. The `next-auth` module is lazy-loaded so it never fails in CLI or Docker test environments.
