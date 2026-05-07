# KLAO Core — AI API Reference

Technical summary of the KLAO Core Headless CRM API for AI Agents.

## Base Context
- **Core Schema**: `core` (Auth/Identity, RBAC, Metadata, Audit)
- **Tenant Schemas**: `tenant_{schemaName}` (Dynamic Data — one per tenant)
- **Runtime**: Bun / Next.js
- **Auth**: NextAuth (Auth.js) — JWT strategy. Token carries `id`, `tenantId`, `role`, `teamId`.

## Request Security Pipeline (Order is MANDATORY)
```
Incoming Request
  → getAppSession()          [session.ts]           — resolve JWT
  → AccessGuard.check()      [AccessGuard.ts]        — RBAC object-level check
  → TransactionContext.run() [TransactionContext.ts] — inject RLS context (SET LOCAL)
  → QueryLayer (DML)         [QueryLayer.ts]         — execute + audit log (atomic)
```

## Endpoints Summary

### 1. Provisioning
`POST /api/tenant/provision`
- Creates Tenant, Schema, Admin Team, and User atomically.
- **Mode A (New User)**: `{ name, adminEmail }`
- **Mode B (Existing User)**: `{ name, existingUserId }`
- Rule: `name` always required. `adminEmail` XOR `existingUserId`.

### 2. Metadata (Schema Definition)
`POST /api/metadata/objects` — Create Table. Payload: `{ name, tableName, description? }`

`POST /api/metadata/fields` — Add Field. Payload: `{ tableId, name, fieldName, physicalType, logicalType, config?, isRequired }`

`GET /api/metadata/[tableName]` — Full Table Schema (Fields + Rules).

`GET /api/metadata/objects` — List all Tables.

### 3. Identity & Access Management (IAM)
`POST /api/auth/register` — Register internal KLAO Identity user. Payload: `{ email, password, name? }`

`GET /api/users/me` — *(Phase 4 — Not yet implemented)* Current user session context.

`POST /api/tenant/users` — *(Phase 4 — Not yet implemented)* Admin provisions a user into their tenant.

### 4. Dynamic Data (CRUD)
`POST /api/dynamic/[tableName]` — Insert record (Auth → RBAC → RLS → Audit).

`GET /api/dynamic/[tableName]` — Query all records (scoped by RLS).

`PATCH /api/dynamic/[tableName]/[id]` — Update record (Auth → RBAC → RLS → Audit).

`DELETE /api/dynamic/[tableName]/[id]` — Delete record (Auth → RBAC → RLS → Audit).

## Roles
| Role | Behaviour |
|---|---|
| `SUPER_ADMIN` | `AccessGuard` fast-path — bypasses DB lookup entirely |
| `TENANT_ADMIN` | Full CRUD within their tenant; subject to `object_permissions` |
| `MEMBER` | Subject to `object_permissions` and RLS ownership model |

## Architectural Constraints
1. **Connection Management**: All services resolve connections via `ConnectionManager` singleton. Supports `SCHEMA_PER_TENANT` (active) and `DATABASE_PER_TENANT` (future).
2. **Deduplication**: Tenant provisioning auto-appends `_1`, `_2` to schema names on name conflict.
3. **Schema Separation**: `core` = Prisma-managed metadata + auth. `tenant_*` = dynamic user data.
4. **Audit Trails**: ALL DML mutations are intercepted and atomically logged to `core.audit_logs` in the same transaction.
5. **RLS**: PostgreSQL RLS policies evaluate `current_setting('app.current_user_id')`. Non-superuser DB role required for RLS to activate.
6. **Test Session Override**: Set `TEST_SESSION_JSON` env var to inject a fake session in CLI/Docker test contexts.
