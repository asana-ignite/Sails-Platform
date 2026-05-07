# KLAO Core — API Documentation

This document provides a comprehensive guide to the **KLAO Core** REST API (`klao.app`). The platform is designed as a Headless CRM Engine, allowing full control over tenants, metadata, and dynamic data via standardized HTTP endpoints. The **KLAO Console** (frontend) consumes these APIs.

> **Security Pipeline (every authenticated route):**
> `getAppSession()` → `AccessGuard.check()` → `TransactionContext.run()` → `QueryLayer (DML + Audit)`


---

## 1. Tenant Provisioning
Endpoints for onboarding new customers and setting up isolated database environments.

### `POST /api/tenant/provision`
Provisions a new tenant, creates their physical PostgreSQL schema, and initializes the administrator account.

Supports two modes:
- **New User Mode**: Provide `adminEmail` to create a new admin user during provisioning.
- **Existing User Mode**: Provide `existingUserId` to attach a pre-existing user as the tenant admin.

**Request Body (New User Mode):**
```json
{
  "name": "Acme Corporation",
  "adminEmail": "admin@acme.com"
}
```

**Request Body (Existing User Mode):**
```json
{
  "name": "Acme Corporation",
  "existingUserId": "uuid-of-existing-user"
}
```

> **Note:** `name` is always required. Exactly one of `adminEmail` or `existingUserId` must be provided. Providing neither returns a `400` error.

**Response (201 Created) — both modes:**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Acme Corporation",
    "schemaName": "tenant_acme_corporation",
    "createdAt": "datetime"
  },
  "adminTeam": {
    "id": "uuid",
    "name": "System Administrator",
    "isSystemAdmin": true
  },
  "user": {
    "id": "uuid",
    "email": "admin@acme.com",
    "tenantId": "uuid",
    "teamId": "uuid"
  }
}
```

---

## 2. Console Configuration
Endpoints for fetching UI metadata and frontend settings.

### `GET /api/console/config`
Retrieves the list of Apps and their nested Menus for the current tenant.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "apps": [
      {
        "id": "uuid",
        "name": "Dashboard",
        "icon": "LayoutDashboard",
        "order": 0,
        "menus": [
          {
            "id": "uuid",
            "label": "Overview",
            "icon": "Activity",
            "path": "/",
            "actionType": "plugin",
            "order": 0,
            "children": []
          }
        ]
      }
    ]
  }
}
```

### `POST /api/console/apps`
Creates a new Console App. Required `TENANT_ADMIN` or `SUPER_ADMIN`.

**Request Body:**
```json
{
  "name": "Sales CRM",
  "icon": "TrendingUp",
  "order": 1
}
```

### `PATCH /api/console/apps/[id]`
Updates an existing app (name, icon, or order).

### `DELETE /api/console/apps/[id]`
Deletes an app and all its associated menus (cascade).

### `POST /api/console/menus`
Creates a new Navigation Menu item.

**Request Body:**
```json
{
  "appId": "uuid",
  "label": "My Leads",
  "icon": "Users",
  "path": "/leads",
  "actionType": "table",
  "parentId": null,
  "order": 0
}
```

### `PATCH /api/console/menus/[id]`
Updates a menu item (label, path, icon, order, etc.).

### `DELETE /api/console/menus/[id]`
Deletes a specific menu item.

> **Note:** If no apps are configured in the database for the tenant, the API returns a default high-quality mock structure to ensure frontend functionality.

---

## 3. Metadata Management
Endpoints for defining the structure of the CRM (Tables and Fields).

### `POST /api/metadata/objects`
Creates a new dynamic Table.

**Request Body:**
```json
{
  "name": "Leads",
  "tableName": "leads",
  "description": "Potential customers"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "Leads",
  "tableName": "leads",
  "description": "Potential customers",
  "tenantId": "uuid"
}
```

### `GET /api/metadata/objects`
Retrieves all defined Tables in the system.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "Leads",
    "tableName": "leads",
    "_count": { "fields": 5 }
  }
]
```

### `POST /api/metadata/fields`
Adds a new Field to an existing Table.

**Request Body:**
```json
{
  "tableId": "uuid",
  "name": "Email Address",
  "fieldName": "email",
  "physicalType": "text",
  "logicalType": "email",
  "isRequired": true,
  "config": null
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "tableId": "uuid",
  "name": "Email Address",
  "fieldName": "email",
  "physicalType": "text",
  "logicalType": "email",
  "isRequired": true
}
```

### `GET /api/metadata/[tableName]`
Fetches the full schema definition for a specific Table, including all Fields and validation rules.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Leads",
  "tableName": "leads",
  "fields": [
    {
      "name": "Email Address",
      "fieldName": "email",
      "rules": []
    }
  ]
}
```

---

## 3. Dynamic Data CRUD
Endpoints for interacting with the records inside the dynamically generated tables.

### `POST /api/dynamic/[tableName]`
Inserts a new record into a dynamic table.

**Path Parameters:**
- `entityName`: The physical `tableName` of the Table.

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com"
}
```

**Response (201 Created):**
Returns the inserted record including system fields (`id`, `created_at`, `owner_id`, etc.).

### `GET /api/dynamic/[tableName]`
Retrieves all records from a dynamic table, ordered by creation date descending.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "first_name": "John",
    "email": "john@example.com",
    "created_at": "datetime"
  }
]
```

### `PATCH /api/dynamic/[tableName]/[id]`
Updates specific fields of an existing dynamic record.

**Request Body:**
```json
{ "first_name": "Jane" }
```

**Response (200 OK):** Returns the updated record including `updated_at` and `updated_by`.

### `DELETE /api/dynamic/[tableName]/[id]`
Deletes a record. Captured in `core.audit_logs` (with `old_values`) within the same transaction.

**Response (204 No Content)**

---

## 4. Identity & Access Management (IAM)
Endpoints for authenticating and managing users via NextAuth/Auth.js.

### `POST /api/auth/register`
Creates a new user account internally using KLAO Identity. Passwords are automatically hashed via bcrypt.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "password": "SecurePassword123!"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "MEMBER",
    "tenantId": null,
    "teamId": null
  }
}
```

### `GET /api/users/me`
Retrieves the current authenticated user's session details, including their tenant association and role.

Retrieves the current authenticated user's session details, including their tenant association and role.

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "TENANT_ADMIN",
    "tenantId": "uuid",
    "teamId": "uuid"
  }
}
```

### `POST /api/tenant/users`
Allows Tenant Admins to provision new users directly into their tenant environment.

Allows Tenant Admins to provision new users directly into their tenant environment.

**Request Body:**
```json
{
  "email": "jane@example.com",
  "name": "Jane Smith",
  "role": "MEMBER",
  "teamId": "optional-uuid"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "jane@example.com",
    "name": "Jane Smith",
    "role": "MEMBER",
    "tenantId": "uuid-of-admin-tenant"
  }
}
```

---

## Security Note
All requests must include a valid **Auth.js JWT** (via session cookie or bearer header). The engine automatically extracts `tenantId` and `role` from the token to enforce:
- **Object-Level Security** (`AccessGuard`) — checks `core.object_permissions` per Team.
- **Row-Level Security** (`TransactionContext`) — injects `SET LOCAL app.current_user_id` into PostgreSQL to activate native RLS policies.
- **Audit Logging** (`QueryLayer`) — every DML mutation is atomically logged to `core.audit_logs`.

`SUPER_ADMIN` role bypasses `AccessGuard` DB lookup entirely (fast-path).
