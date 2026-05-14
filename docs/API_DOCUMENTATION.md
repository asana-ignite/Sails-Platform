# API & Security Pipeline

## The Mandatory Security Pipeline (Order is STRICT)
1. **Authentication (`getAppSession`)**: Resolves identity and context.
2. **RBAC (`AccessGuard`)**: Enforces object-level capabilities.
3. **RLS (`TransactionContext`)**: Injects context into PostgreSQL.
4. **DML & Audit (`QueryLayer`)**: Ensures atomic data mutation and logging.
5. **Verification (`test-security.ts`)**: Validates pipeline integrity.
- **Warning:** Failure at any stage MUST result in immediate HTTP error.

## Provisioning Rules
- **Endpoint:** `POST /api/tenant/provision`
- **Rule:** `name` is always required. Exactly one of `adminEmail` or `existingUserId` must be provided.
- **Deduplication:** Auto-appends `_1`, `_2` to schema names on conflict.

## Module (App) Configuration
- **Endpoint:** `GET /api/console/config`
- **Rule:** `POST /api/console/apps` requires `TENANT_ADMIN` or `SUPER_ADMIN`.

## Metadata Management
- **Rule:** `POST /api/metadata/objects` (Create Table), `POST /api/metadata/fields` (Add Field).

## Dynamic Data CRUD
- **Rule:** Accessing `[tableName]` MUST respect the Security Pipeline.
- **Warning:** `DELETE /api/dynamic/[tableName]/[id]` captures `old_values` in `core.audit_logs` atomically.

## Roles
- **`SUPER_ADMIN`:** `AccessGuard` fast-path — bypasses DB lookup.
- **`TENANT_ADMIN`:** Full CRUD within business unit; subject to `object_permissions`.
- **`MEMBER`:** Subject to `object_permissions` and RLS ownership.
