# SAILS Platform — Zoning Multi-Tenancy Architecture

This document defines the architectural specifications for **Cell-Based Zoning Multi-Tenancy** on the SAILS Platform.

---

## 1. Executive Summary

As SAILS scales across enterprise clients, multi-region deployments (AWS, Azure, GCP, and local on-premise servers), and varying compliance regimes (GDPR, HIPAA, GovCloud), the platform moves from a single multi-tenant database into a **Cell-Based Zoning Architecture**.

- **Zone (Cell)**: A self-contained deployment unit comprising a `Core API` cluster, static `Console UI`, and PostgreSQL Database.
- **Zone 01 Baseline**: Out-of-the-box single-instance deployment operates as **Zone 01** (`PLATFORM_MODE="standalone"`).
- **Global Control Plane**: A centralized, lightweight directory (`sails_global_master`) mapping tenants to their respective Zones.
- **Super Admin War Room**: A standalone control plane dashboard hosted in a **separate repository/project** that consumes SAILS Zone Telemetry APIs (`GET /api/zone/health`) to aggregate metrics across all active Zones.

---

## 2. System Topology

```mermaid
graph TD
    Client[Browser / Mobile Client] --> Router[Global Domain Router]
    
    subgraph Global Control Plane
        Router --> MasterDB[(Global Registry: sails_global_master)]
        WarRoom[Super Admin War Room] --> MasterDB
    end
    
    subgraph Zone 01 (US Primary - Shared)
        Router --> Core1[Core API - Zone 01]
        Core1 --> DB1[(PostgreSQL DB 1 - 100 Tenants)]
    end
    
    subgraph Zone 02 (EU Frankfurt - Shared)
        Router --> Core2[Core API - Zone 02]
        Core2 --> DB2[(PostgreSQL DB 2 - 50 Tenants)]
    end
    
    subgraph Zone 03 (Dedicated Enterprise)
        Router --> Core3[Core API - Zone 03]
        Core3 --> DB3[(PostgreSQL DB 3 - Dedicated Tenant)]
    end
    
    Core1 -. Async Telemetry .-> WarRoom
    Core2 -. Async Telemetry .-> WarRoom
    Core3 -. Async Telemetry .-> WarRoom
```

---

## 3. Global Control Plane Schema (`sails_global_master`)

The Global Control Plane maintains high-speed tenant mapping without storing application data:

```sql
-- Global Tenant Registry
CREATE TABLE global_tenants (
  id VARCHAR(30) PRIMARY KEY, -- CUID
  slug VARCHAR(50) UNIQUE NOT NULL,
  domain VARCHAR(100),
  zone_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- ACTIVE, MIGRATING, SUSPENDED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zone Registry
CREATE TABLE global_zones (
  id VARCHAR(50) PRIMARY KEY, -- e.g. 'zone-us-01'
  name VARCHAR(100) NOT NULL,
  api_url VARCHAR(255) NOT NULL,
  region VARCHAR(50) NOT NULL,
  max_tenants INT DEFAULT 100,
  current_tenants INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'healthy'
);
```

---

## 4. Zone Telemetry & War Room Architecture

To fuel the **Super Admin War Room** without blocking database queries or introducing cross-network JOIN bottlenecks:

1. **Pull Model (Health Endpoint)**:
   - Each Core API container exposes `GET /api/zone/health` (secured via `ZONE_SECRET_KEY`).
   - Returns JSON metrics:
     ```json
     {
       "zoneId": "zone-us-01",
       "status": "healthy",
       "memoryUsageMB": 184,
       "activeDbConnections": 12,
       "tenantCount": 42,
       "errorCount15m": 0,
       "uptimeSeconds": 86400
     }
     ```
2. **Push Model (Async Alerting)**:
   - `SchemaLogger` dispatches async HTTP POST payloads (`fire-and-forget`) to the War Room telemetry collector when unhandled database exceptions occur.

---

## 5. Tenant Migration & Autonumber Continuation Protocol

When a tenant outgrows a shared Zone or requires relocation to a dedicated regional Zone, the migration pipeline preserves full data integrity and Autonumber sequence continuity:

```
[ 1. Set Status = 'MIGRATING' ] -> [ 2. pg_dump tenant_{schema} ] -> [ 3. pg_restore into Target DB ] -> [ 4. Update Global Tenant zone_id ] -> [ 5. Release Lock ]
```

### Autonumber Preservation
PostgreSQL sequence definitions (`CREATE SEQUENCE`) and table-backed sequence tracking tables carry their exact counter (`setval('tenant_acme.inv_seq', 1042)`) during `pg_dump`. Upon restoration in the new Zone database, the next generated auto-number will naturally continue at `1043`.

---

## 6. Developer Guidelines for Zone Readiness

1. **CUID Primaries**: Always use CUIDs or time-ordered string IDs (`generateTimeOrderedId()`) for primary keys. Never use auto-incrementing integers.
2. **Stateless Core API**: Core API must read `ZONE_ID` from the environment and resolve DB connection pools dynamically when `PLATFORM_MODE="zoned"`.
3. **Per-Tenant Autonumber Sequences**: Sequence counters must remain scoped to `tenant_id` or tenant schema. Never share a global sequence across tenants.
