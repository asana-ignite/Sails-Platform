# INIDOS Core — AI API Reference

Technical summary of the **INIDOS Core** Internal Operating System API for AI Agents.

## Base Context
- **Core Schema**: `core` (Auth/Identity, RBAC, Metadata, Audit)
- **Tenant Schemas**: `tenant_{schemaName}` (Dynamic Data — one per business unit)
- **Runtime**: Bun / Next.js
- **Auth**: NextAuth (Auth.js) — JWT strategy. Token carries `id`, `tenantId`, `role`, `teamId`.

## Request Security Pipeline (MANDATORY Order)

Every request to INIDOS Core must survive the following pipeline. Failure at any stage results in immediate termination with appropriate HTTP error codes.

| Step | Layer | Component | Owner | Responsibility |
|---|---|---|---|---|
| **1** | **Authentication** | `getAppSession()` | **Backend Engineer** | Resolve staff JWT, validate expiry, and extract context. |
| **2** | **Object-Level RBAC** | `AccessGuard.check()` | **Backend Engineer** | Verify that the staff's active team has the necessary capabilities for the target object. |
| **3** | **RLS Context** | `TransactionContext.run()` | **Database Engineer** | Inject user and tenant context into the PostgreSQL session using `SET LOCAL` variables. |
| **4** | **DML & Auditing** | `QueryLayer` (DML) | **Backend Engineer** | Execute the query and ensure an atomic audit log is recorded. |
| **V** | **Verification** | `test-security.ts` | **QA Tester** | Automate regression tests to ensure the pipeline remains unbreakable. |

## Endpoints Summary

### 1. Provisioning
`POST /api/tenant/provision`
- Creates Business Unit, Schema, Admin Team, and User atomically.
- **Mode A (New User)**: `{ name, adminEmail }`
- **Mode B (Existing User)**: `{ name, existingUserId }`
- Rule: `name` always required. `adminEmail` XOR `existingUserId`.

### 2. Metadata (Schema Definition)
`POST /api/metadata/objects` — Create Table (e.g. "Projects"). Payload: `{ name, tableName, description? }`

`POST /api/metadata/fields` — Add Field. Payload: `{ tableId, name, fieldName, physicalType, logicalType, config?, isRequired }`

`GET /api/metadata/[tableName]` — Full Table Schema (Fields + Rules).

`GET /api/metadata/objects` — List all Tables.

### 3. Identity & Access Management (IAM)
`POST /api/auth/register` — Register internal staff identity. Payload: `{ email, password, name? }`

`GET /api/users/me` — Current user session context.

`POST /api/tenant/users` — Admin provisions a user into their business unit.

### 4. Dynamic Data (CRUD)
`POST /api/dynamic/[tableName]` — Insert record (Auth → RBAC → RLS → Audit).

`GET /api/dynamic/[tableName]` — Query all records (scoped by RLS).

`PATCH /api/dynamic/[tableName]/[id]` — Update record (Auth → RBAC → RLS → Audit).

`DELETE /api/dynamic/[tableName]/[id]` — Delete record (Auth → RBAC → RLS → Audit).

## Roles
| Role | Behaviour |
|---|---|
| `SUPER_ADMIN` | `AccessGuard` fast-path — bypasses DB lookup entirely |
| `TENANT_ADMIN` | Full CRUD within their business unit; subject to `object_permissions` |
| `MEMBER` | Subject to `object_permissions` and RLS ownership model |

## Architectural Constraints
1. **Connection Management**: All services resolve connections via `ConnectionManager` singleton.
2. **Deduplication**: Business unit provisioning auto-appends `_1`, `_2` to schema names on conflict.
3. **Schema Separation**: `core` = Prisma-managed metadata + staff auth. `tenant_*` = dynamic internal data.
4. **Audit Trails**: ALL DML mutations are intercepted and atomically logged to `core.audit_logs`.
5. **RLS**: PostgreSQL RLS policies evaluate `current_setting('app.current_user_id')`.
6. **Test Session Override**: Set `TEST_SESSION_JSON` env var to inject a fake session in test contexts.
