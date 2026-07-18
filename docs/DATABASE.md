# Database Architecture & Security

## Schema Segregation Rule
- **Rule:** Strict logical boundary between system metadata and user data.
- **`core` Schema:** Metadata & Engine. Prisma-managed. NO direct read/write access for staff.
- **`tenant_{schemaName}` Schema:** Dynamic Data. One per business unit.

## Table Lifecycle
- **Creation:** `TranslatorLayer.ts` writes to `core.tables`. `AlchemaCore.ts` executes `CREATE TABLE tenant_X...`.
- **Mandatory Columns:** `id` (CUID/String), `created_at`, `updated_at`, `owner_id`, `created_by`, `updated_by`.

## Security & Row-Level Security (RLS)
- **Rule:** Database enforces RLS natively on dynamic tables.
- **Execution:** `TransactionContext` injects user/tenant ID via `SET LOCAL` during query execution.
- **Warning:** `AlchemaCore` MUST bind the `projects_owner_policy` (or equivalent) upon table creation.

## Asynchronous Audit Logging
- **Rule:** ALL DML operations must be wrapped by `QueryLayer.ts`.
- **Requirement (10k OPS):** Mutations MUST write to `core.audit_logs` *asynchronously*, outside of the main exact transaction, to prevent holding row locks and inflating write contention.

## Testing
- **Test Override:** `session.ts` supports `TEST_SESSION_JSON` for CLI/Docker integration testing without browser context.
