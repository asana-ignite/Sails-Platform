# INIDOS Core — Database Architecture

This document outlines the database architecture that powers **INIDOS Core**. To ensure enterprise-grade security for Ignite Idea's internal data, the system enforces a strict logical boundary between system metadata and user data through schema segregation.

## 1. Schema Separation Strategy

The PostgreSQL database is divided into two distinct logical areas. The specific isolation model is governed by the `ConnectionManager` singleton:

| Strategy | Description | Status |
|---|---|---|
| `SCHEMA_PER_TENANT` | All departments/subsidiaries share one database, each with an isolated schema | ✅ Active |
| `DATABASE_PER_TENANT` | Each subsidiary gets a completely separate database | 🔮 Future-ready |

All services (`AlchemaCore`, `QueryLayer`, `TenantProvisioner`) resolve their database connections through the `ConnectionManager`. This ensures that internal data isolation is maintained across different Ignite Idea business units.

### `core` (The Metadata & Engine Schema)
The `core` schema is the protected central nervous system of INIDOS. Staff members *never* have direct read or write access to this schema. It is managed entirely by **Prisma** and contains:

| Category | Tables |
|---|---|
| **Auth / Identity** | `users` (Staff profiles), `accounts`, `sessions`, `verification_tokens` |
| **RBAC / Teams** | `teams` (Departments), `object_permissions`, `user_teams` (Join table) |
| **Metadata** | `tenants` (Business units), `tables`, `fields`, `validation_rules` |
| **Console Metadata** | `console_apps`, `console_menus` |
| **Audit** | `audit_logs` |

### `tenant_{schemaName}` (The Dynamic Data Schemas)
For every business unit or subsidiary, a dedicated physical schema is generated (e.g., `tenant_ignite_sales`).
- This physically isolates project and sales data from other internal units.
- Staff interact *only* with tables built dynamically inside their respective `tenant_*` schema.

## 2. Table Lifecycle & Dynamic DDL

When a new module or data structure is defined (e.g., "Projects"), the platform:
1. `TranslatorLayer.ts` writes the blueprint into the `core.tables` metadata.
2. `AlchemaCore.ts` executes raw, sanitized SQL (`pg-format`) to physically create a true PostgreSQL table: `CREATE TABLE tenant_ignite.projects (...)`.
3. Standard columns are strictly injected into every dynamic table:
   - `id` (UUID Primary Key)
   - `created_at`, `updated_at` (Timestamps)
   - `owner_id`, `created_by`, `updated_by` (Foreign Keys back to staff in `core.users`)

## 3. Database Security & Transactions

### Row-Level Security (RLS)
The database enforces security at the engine level to protect sensitive internal data (Financials, Sales Pipelines, Staffing).
When `AlchemaCore` creates a dynamic table (e.g., `tenant_ignite.projects`), it binds this RLS policy:

```sql
CREATE POLICY projects_owner_policy ON tenant_ignite.projects FOR ALL USING (
    (SELECT view_all_data FROM core.object_permissions
     WHERE team_id = (SELECT team_id FROM core.users WHERE id = current_setting('app.current_user_id')::uuid)
       AND object_name = 'projects') = true
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
1. A user's request hits the API. `QueryLayer` resolves the session.
2. `TransactionContext` injects the staff ID and tenant ID into the active PostgreSQL session via `SET LOCAL`.
3. PostgreSQL evaluates the policy natively. It checks if the staff's Team has `view_all_data`, if they own the project, or if they are in a management position above the owner.

### Atomic Audit Logging
`QueryLayer.ts` wraps all DML operations. Whenever an internal record is mutated, the `QueryLayer` captures changes and writes to `core.audit_logs` *within the exact same transaction*. This ensures a perfect audit trail for all business-critical operations.

### Session Mock for Testing
`session.ts` supports a `TEST_SESSION_JSON` override for integration testing within CLI or Docker environments, allowing the security suite to verify RLS and RBAC without a live browser context.
