# INIDOS Core — API Documentation

This document provides a comprehensive guide to the **INIDOS Core** REST API. The platform is designed as an internal operating system, allowing full control over business units, metadata, and dynamic internal data via standardized HTTP endpoints. The **INIDOS Console** (frontend) consumes these APIs.

> **The Mandatory Security Pipeline:**
> 1.  **Authentication (`getAppSession`)**: Owned by **Backend Engineer**. Resolves identity and internal context.
> 2.  **RBAC (`AccessGuard`)**: Owned by **Backend Engineer**. Enforces object-level capabilities.
> 3.  **RLS (`TransactionContext`)**: Owned by **Database Engineer**. Injects context into PostgreSQL.
> 4.  **DML & Audit (`QueryLayer`)**: Owned by **Backend Engineer**. Ensures atomic data mutation and logging.
> 5.  **Verification (`test-security.ts`)**: Owned by **QA Tester**. Validates the pipeline integrity.


---

## 1. Business Unit (Tenant) Provisioning
Endpoints for onboarding new internal departments or subsidiaries.

### `POST /api/tenant/provision`
Provisions a new business unit, creates their physical PostgreSQL schema, and initializes the administrator account.

Supports two modes:
- **New User Mode**: Provide `adminEmail` to create a new staff admin during provisioning.
- **Existing User Mode**: Provide `existingUserId` to attach pre-existing staff as the admin.

**Request Body (New User Mode):**
```json
{
  "name": "Ignite Sales",
  "adminEmail": "admin@igniteidea.ai"
}
```

**Request Body (Existing User Mode):**
```json
{
  "name": "Ignite Sales",
  "existingUserId": "uuid-of-existing-staff"
}
```

> **Note:** `name` is always required. Exactly one of `adminEmail` or `existingUserId` must be provided.

**Response (201 Created):**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Ignite Sales",
    "schemaName": "tenant_ignite_sales",
    "createdAt": "datetime"
  },
  "adminTeam": {
    "id": "uuid",
    "name": "System Administrator",
    "isSystemAdmin": true
  },
  "user": {
    "id": "uuid",
    "email": "admin@igniteidea.ai",
    "tenantId": "uuid",
    "role": "TENANT_ADMIN",
    "isActive": true
  }
}
```

---

## 2. Console Configuration
Endpoints for fetching UI metadata and internal dashboard settings.

### `GET /api/console/config`
Retrieves the list of Modules (Apps) and their nested Menus for the current user.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "apps": [
      {
        "id": "uuid",
        "name": "Sales",
        "icon": "TrendingUp",
        "order": 0,
        "menus": [
          {
            "id": "uuid",
            "label": "Leads",
            "icon": "Users",
            "path": "/leads",
            "actionType": "table",
            "order": 0
          }
        ]
      }
    ]
  }
}
```

### `POST /api/console/apps`
Creates a new Module. Required `TENANT_ADMIN` or `SUPER_ADMIN`.

### `PATCH /api/console/apps/[id]`
Updates an existing module (name, icon, or order).

### `DELETE /api/console/apps/[id]`
Deletes a module and all its associated menus.

---

## 3. Metadata Management
Endpoints for defining internal data structures (Projects, Tasks, Timesheets).

### `POST /api/metadata/objects`
Creates a new dynamic Table (e.g. "Projects").

**Request Body:**
```json
{
  "name": "Projects",
  "tableName": "projects",
  "description": "Internal Ignite Idea projects"
}
```

### `GET /api/metadata/objects`
Retrieves all defined Tables in the system.

### `POST /api/metadata/fields`
Adds a new Field to an existing Table.

**Request Body:**
```json
{
  "tableId": "uuid",
  "name": "Project Deadline",
  "fieldName": "deadline",
  "physicalType": "date",
  "logicalType": "date",
  "isRequired": true
}
```

### `GET /api/metadata/[tableName]`
Fetches the full schema definition for a specific Table.

---

## 3. Dynamic Data CRUD
Endpoints for interacting with records (Sales Leads, Tasks, Timesheet entries).

### `POST /api/dynamic/[tableName]`
Inserts a new record into a dynamic table.

**Request Body:**
```json
{
  "project_name": "New Website",
  "deadline": "2026-12-31"
}
```

### `GET /api/dynamic/[tableName]`
Retrieves all records from a dynamic table, ordered by creation date descending.

### `PATCH /api/dynamic/[tableName]/[id]`
Updates specific fields of an existing record.

### `DELETE /api/dynamic/[tableName]/[id]`
Deletes a record. Captured in `core.audit_logs` (with `old_values`) within the same transaction.

---

## 4. Identity & Access Management (IAM)
Endpoints for authenticating and managing staff via NextAuth/Auth.js.

### `POST /api/auth/register`
Creates a new staff account internally using **INIDOS Identity**.

### `GET /api/users/me`
Retrieves the current authenticated user's session details, including their department and permissions.

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "name": "Staff Member",
    "email": "staff@igniteidea.ai",
    "role": "TENANT_ADMIN",
    "tenantId": "uuid",
    "teams": [
      { "team": { "id": "uuid", "name": "Management" }, "isLeader": true }
    ]
  }
}
```

### `POST /api/tenant/users`
Allows Admins to provision new staff directly into their department environment.

**Request Body:**
```json
{
  "email": "new.staff@igniteidea.ai",
  "name": "New Staff",
  "role": "MEMBER",
  "teamIds": ["optional-uuid-1"]
}
```

---

## Security Pipeline & Ownership
All requests to INIDOS Core must survive the following pipeline. Failure at any stage results in immediate termination with appropriate HTTP error codes.

### 1. Authentication (Backend Engineer)
- **Component**: `getAppSession()` in `packages/core/src/lib/auth/session.ts`.
- **Action**: Resolves the staff JWT, validates the signature, and extracts context.

### 2. Object-Level RBAC (Backend Engineer)
- **Component**: `AccessGuard.check()` in `packages/core/src/core/engine/AccessGuard.ts`.
- **Action**: Ensures the staff's active team has the required capabilities for the specific metadata object.

### 3. RLS Context Injection (Database Engineer)
- **Component**: `TransactionContext.run()` in `packages/core/src/core/engine/TransactionContext.ts`.
- **Action**: Uses `SET LOCAL` to inject `app.current_user_id` and `app.current_tenant_id` enabling native Row-Level Security.

### 4. Atomic DML & Auditing (Backend Engineer)
- **Component**: `QueryLayer` in `packages/core/src/core/engine/QueryLayer.ts`.
- **Action**: Executes the data mutation and guarantees an atomic entry in `core.audit_logs`.

### 5. Continuous Verification (QA Tester)
- **Component**: `packages/core/test-security.ts`.
- **Action**: A suite of regression tests covering 8+ security scenarios that MUST be run after any change.
ge.
