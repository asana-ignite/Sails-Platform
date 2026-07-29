# SAILS Platform Knowledge Graph Report

## Overview

- **Total Nodes:** 184
- **Total Edges:** 180
- **Communities Detected:** 68
- **Average Degree:** 1.96

## Architecture Summary

The SAILS Platform is a **multi-tenant, schema-per-tenant platform** built as a monorepo with three packages:
- **packages/core** (Next.js API + Prisma ORM + Core Engine)
- **packages/console** (React/Vite Admin UI)
- **packages/shared** (TypeScript types)

The core engine consists of:
- **ConnectionManager** — Singleton managing PostgreSQL connection pools, supporting both SCHEMA_PER_TENANT and DATABASE_PER_TENANT isolation strategies
- **AlchemaCore** — DDL engine that creates tenant schemas, tables, columns, RLS policies, sequences, and check constraints
- **AccessGuard** — Application-layer object-level security checking CRUD permissions via Prisma
- **QueryLayer** — Secure query execution orchestrating AccessGuard -> TransactionContext -> Audit Log
- **TransactionContext** — Injects user session variables via `SET LOCAL` for PostgreSQL RLS enforcement
- **SchemaLogger** — Async fire-and-forget DDL and system event logging
- **FieldRegistry** — Plugin system with 13 field types (ShortText, Number, Boolean, Date, Relation, Select, Currency, etc.)

The console is a React/Vite SPA with:
- DB-driven navigation via `ConsoleContext` fetching `/api/console/config`
- Layout components: AppLayout, Sidebar, Topbar, MobileNav
- Admin pages mapped through `AdminPluginRegistry` by `componentKey` from DB metadata
- Theme system with dynamic palette generation and server-side branding

The platform supports **Cell-Based Zoning** architecture with a Global Control Plane (`GlobalZone`, `GlobalTenant`, `ZoneHealthMetric`) for multi-database deployment.

## God Nodes (Highest Degree Centrality)

These are the most connected nodes in the graph — the architectural hubs:

**1. AdminPluginRegistry** (Registry)
   - Centrality: 0.1202
   - Node ID: `util:AdminPluginRegistry`
**2. FieldRegistry** (Class)
   - Centrality: 0.0984
   - Node ID: `class:FieldRegistry`
**3. FieldTypePlugin** (Class)
   - Centrality: 0.0929
   - Node ID: `class:FieldTypePlugin`
**4. ConsoleContext** (ReactContext)
   - Centrality: 0.0546
   - Node ID: `ctx:ConsoleContext`
**5. Tenant** (PrismaModel)
   - Centrality: 0.0492
   - Node ID: `prisma:Tenant`
**6. User** (PrismaModel)
   - Centrality: 0.0492
   - Node ID: `prisma:User`
**7. TenantProvisioner** (Class)
   - Centrality: 0.0492
   - Node ID: `class:TenantProvisioner`

## Communities

### Prisma Data Models (22 tables) (22 nodes, 33 edges, cohesion: 0.1429)

  - User (PrismaModel)
  - Tenant (PrismaModel)
  - Team (PrismaModel)
  - TableDefinition (PrismaModel)
  - ConsoleMenu (PrismaModel)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - RelationFieldConfig (Type/Interface)

### Prisma Data Models (1 tables) (1 nodes, 0 edges, cohesion: 0)

  - VerificationToken (PrismaModel)

### Prisma Data Models (1 tables) (1 nodes, 0 edges, cohesion: 0)

  - AccessScope (PrismaModel)

### Architecture Concepts (28 nodes, 39 edges, cohesion: 0.1032)

  - TenantProvisioner (Class)
  - TranslatorLayer (Class)
  - ConnectionManager (Class)
  - AlchemaCore (Class)
  - /api/zone/health (API Route)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - AutoNumberFieldConfig (Type/Interface)

### Query & Security Layer (8 nodes, 9 edges, cohesion: 0.3214)

  - QueryLayer (Class)
  - AccessGuard (Class)
  - getAppSession() (Utility)
  - /api/dynamic/[tableName] (API Route)
  - knex (Pool) (Utility)

### Field Type Plugins (19 nodes, 32 edges, cohesion: 0.1871)

  - FieldTypePlugin (Class)
  - FieldRegistry (Class)
  - TextType (FieldTypePlugin)
  - CurrencyType (FieldTypePlugin)
  - ShortTextType (FieldTypePlugin)

### Core Utilities & Libs (1 nodes, 0 edges, cohesion: 0)

  - SystemPermissionRegistry (Utility)

### Core Utilities & Libs (1 nodes, 0 edges, cohesion: 0)

  - authOptions (Utility)

### Layout & Navigation (23 nodes, 35 edges, cohesion: 0.1383)

  - ConsoleContext (ReactContext)
  - AppLayout (ReactComponent)
  - Topbar (ReactComponent)
  - App (ReactComponent)
  - Sidebar (ReactComponent)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/console/apps (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/console/menus (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/console/layouts (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/console/audit-logs (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/console/permissions (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/metadata/[tableName] (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/metadata/field-types (API Route)

### API Routes & Endpoints (1 nodes, 0 edges, cohesion: 0)

  - /api/auth/register (API Route)

### CLI Tools (1 nodes, 0 edges, cohesion: 0)

  - sync-all-tenants (CLI)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - Dashboard (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - DynamicTablePage (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - Login (ReactComponent)

### Admin UI Pages (1 nodes, 0 edges, cohesion: 0)

  - AdminLogin (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - Unauthorized (ReactComponent)

### Admin UI Pages (22 nodes, 21 edges, cohesion: 0.0909)

  - AdminPluginRegistry (Registry)
  - AdminMenuManager (ReactComponent)
  - AdminCompanyProfile (ReactComponent)
  - AdminSSOConfig (ReactComponent)
  - AdminIntegrations (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - ObjectManager (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - UserManager (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - UserDetailsModal (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - LayoutDemo (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - RouteBuilder (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - TableBuilder (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - LoadingScreen (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - IconPicker (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - CustomSelect (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - DraggablePanel (ReactComponent)

### Console UI Components (1 nodes, 0 edges, cohesion: 0)

  - Button (ReactComponent)

### Core Utilities & Libs (1 nodes, 0 edges, cohesion: 0)

  - apiClient (Utility)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - Tenant (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - SailsTableDefinition (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - SailsFieldDefinition (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - ValidationRule (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - Team (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - SailsUser (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - ObjectPermission (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - AuditLog (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - LogicalType (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - FieldTypeMetadata (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - TableLayout (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - LayoutConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - LayoutSection (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - LayoutField (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - RelatedRecord (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - CreateTableRequest (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - CreateFieldRequest (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - GlobalZoneDto (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - GlobalTenantDto (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - ShortTextFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - LongTextFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - NumberFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - CurrencyFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - PercentageFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - PhoneFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - AddressFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - AttachmentFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - BooleanFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - DateFieldConfig (Type/Interface)

### Shared Type Definitions (1 nodes, 0 edges, cohesion: 0)

  - SelectFieldConfig (Type/Interface)

## Surprising Connections (Cross-Community Bridges)

- **AppPluginShell** (10) ←IMPORTS→ **AdminPluginRegistry** (25)
  *AppPluginShell uses AdminPluginRegistry*
- **GET /api/console/config** (10) ←SERVED_BY→ **DB-Driven Navigation** (0)
  *Config API serves navigation*
- **ConsoleContext** (10) ←CONSUMED_BY→ **DB-Driven Navigation** (0)
  *ConsoleContext consumes navigation config*
- **db (PrismaClient)** (4) ←CALLS→ **GET /api/console/config** (10)
  *config route queries Prisma*
- **getAppSession()** (6) ←CALLS→ **GET /api/console/config** (10)
  *config route gets session*
- **AlchemaCore** (4) ←IMPORTS→ **FieldRegistry** (7)
  *AlchemaCore uses FieldRegistry*
- **FieldRegistry** (7) ←IMPORTS→ **TranslatorLayer** (4)
  *TranslatorLayer uses FieldRegistry*
- **AlchemaCore** (4) ←IMPORTS→ **getAppSession()** (6)
  *AlchemaCore uses getAppSession*
- **AccessGuard** (6) ←IMPORTS→ **db (PrismaClient)** (4)
  *AccessGuard uses PrismaClient*
- **QueryLayer** (6) ←IMPORTS→ **TransactionContext** (4)
  *QueryLayer uses TransactionContext*

## Suggested Questions

1. How does the multi-tenancy architecture connect the TenantProvisioner, ConnectionManager, and AlchemaCore?
2. What is the full data flow from an API request like POST /api/dynamic/leads through QueryLayer, AccessGuard, and TransactionContext?
3. How does the Field Registry plugin system allow 13+ field types to define both PostgreSQL DDL and Zod schemas?
4. How does ConsoleContext consume the DB-driven navigation from /api/console/config and render it in Sidebar and Topbar?
5. What is the relationship between ConsoleApp, ConsoleMenu, and the AdminPluginRegistry component mapping?
6. How does the Cell-Based Zoning architecture (GlobalZone, GlobalTenant, TenantConnectionManager) extend baseline multi-tenancy?

## Community Label Map

- Community 0: **Prisma Data Models (22 tables)**
- Community 1: **Shared Type Definitions**
- Community 2: **Prisma Data Models (1 tables)**
- Community 3: **Prisma Data Models (1 tables)**
- Community 4: **Architecture Concepts**
- Community 5: **Shared Type Definitions**
- Community 6: **Query & Security Layer**
- Community 7: **Field Type Plugins**
- Community 8: **Core Utilities & Libs**
- Community 9: **Core Utilities & Libs**
- Community 10: **Layout & Navigation**
- Community 11: **API Routes & Endpoints**
- Community 12: **API Routes & Endpoints**
- Community 13: **API Routes & Endpoints**
- Community 14: **API Routes & Endpoints**
- Community 15: **API Routes & Endpoints**
- Community 16: **API Routes & Endpoints**
- Community 17: **API Routes & Endpoints**
- Community 18: **API Routes & Endpoints**
- Community 19: **CLI Tools**
- Community 20: **Console UI Components**
- Community 21: **Console UI Components**
- Community 22: **Console UI Components**
- Community 23: **Admin UI Pages**
- Community 24: **Console UI Components**
- Community 25: **Admin UI Pages**
- Community 26: **Console UI Components**
- Community 27: **Console UI Components**
- Community 28: **Console UI Components**
- Community 29: **Console UI Components**
- Community 30: **Console UI Components**
- Community 31: **Console UI Components**
- Community 32: **Console UI Components**
- Community 33: **Console UI Components**
- Community 34: **Console UI Components**
- Community 35: **Console UI Components**
- Community 36: **Console UI Components**
- Community 37: **Core Utilities & Libs**
- Community 38: **Shared Type Definitions**
- Community 39: **Shared Type Definitions**
- Community 40: **Shared Type Definitions**
- Community 41: **Shared Type Definitions**
- Community 42: **Shared Type Definitions**
- Community 43: **Shared Type Definitions**
- Community 44: **Shared Type Definitions**
- Community 45: **Shared Type Definitions**
- Community 46: **Shared Type Definitions**
- Community 47: **Shared Type Definitions**
- Community 48: **Shared Type Definitions**
- Community 49: **Shared Type Definitions**
- Community 50: **Shared Type Definitions**
- Community 51: **Shared Type Definitions**
- Community 52: **Shared Type Definitions**
- Community 53: **Shared Type Definitions**
- Community 54: **Shared Type Definitions**
- Community 55: **Shared Type Definitions**
- Community 56: **Shared Type Definitions**
- Community 57: **Shared Type Definitions**
- Community 58: **Shared Type Definitions**
- Community 59: **Shared Type Definitions**
- Community 60: **Shared Type Definitions**
- Community 61: **Shared Type Definitions**
- Community 62: **Shared Type Definitions**
- Community 63: **Shared Type Definitions**
- Community 64: **Shared Type Definitions**
- Community 65: **Shared Type Definitions**
- Community 66: **Shared Type Definitions**
- Community 67: **Shared Type Definitions**
