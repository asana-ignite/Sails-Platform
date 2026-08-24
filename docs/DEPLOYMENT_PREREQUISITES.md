# SAILS Platform — Deployment Prerequisites & Operations Guide

This document defines the authoritative system prerequisites, environment setup, deployment lifecycle, and disaster recovery procedures for deploying the **SAILS Platform** (featuring **Bun 1.4** runtime).

---

## 1. System Architecture & Topology

The SAILS Platform operates as a high-throughput, multi-tenant system:
* **SAILS Core (`packages/core`)**: Headless Backend API & Application Engine running on **Bun 1.4** and **Next.js 14**.
* **SAILS Console (`packages/console`)**: Single-Page Application / PWA built with **Vite 5** and **React 18**.
* **Shared SDK & Plugins (`packages/shared`, `packages/plugin-*`)**: Shared contracts, BYOC script sandboxes, approval workflows, and notification engines.
* **Database**: PostgreSQL 16 with multi-schema multi-tenancy (`core` schema + `tenant_{schema}` schemas) and Row-Level Security (RLS).
* **Zoning Deployment**: Single-instance setups run as **Zone 01**; multi-zone deployments scale into isolated database cells managed by a Global Control Plane.

```
       [ Client / Browser ]
                │
         HTTP (Port 5173 / 443)
                ▼
      ┌──────────────────┐
      │  SAILS Console   │ (Vite / React PWA)
      └─────────┬────────┘
                │ Proxy / API (Port 3000)
                ▼
      ┌──────────────────┐
      │    SAILS Core    │ (Bun 1.4 + Next.js Engine)
      └─────────┬────────┘
                │ PostgreSQL (Port 5433 host / 5432 container)
                ▼
      ┌──────────────────┐
      │  PostgreSQL 16   │ [Schemas: core, tenant_01, tenant_02, ...]
      │  (RLS Enforced)  │ [Volume: klaoplatform_pgdata]
      └──────────────────┘
```

---

## 2. Infrastructure & Runtime Prerequisites

### A. Host Environment Requirements
| Component | Minimum Version | Recommended Version | Purpose |
|---|---|---|---|
| **Bun** | `v1.4.0` | `v1.4.x` (latest) | Native TypeScript runtime, package manager (`bun.lock`), and CLI engine. |
| **Docker Engine** | `24.0.0` | `26.0+` | Containerized process isolation. |
| **Docker Compose** | `v2.20.0` | `v2.27+` | Multi-container orchestration (`docker-compose.yml`). |
| **PostgreSQL** | `16.0` (Alpine) | `16-alpine` | Core metadata and tenant data stores. |

### B. Compute & Memory Sizing
* **Development / Staging**: 2 vCPU, 4 GB RAM, 20 GB SSD.
* **Production Zone Node (10k OPS Target)**:
  * 4–8 vCPUs (x86_64 or ARM64).
  * 8–16 GB RAM (Bun 1.4's Rust core delivers 5x lower idle CPU overhead and minimal baseline memory footprint).
  * High IOPS NVMe Storage for PostgreSQL data volume.

---

## 3. Environment Variables & Secret Configuration

Create a `.env` file in the root workspace prior to deployment:

```bash
# ==========================================
# SAILS Platform Environment Configuration
# ==========================================

# 1. Database Connection
# In-container connection string:
DATABASE_URL=postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core
# Host connection string (for external tools):
# DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5433/postgres?schema=core

# 2. Authentication & Security
NEXTAUTH_SECRET=generate-a-strong-random-secret-at-least-32-chars
NEXTAUTH_URL=http://localhost:5173

# 3. OAuth Providers (Optional / Configurable)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 4. Frontend & Core API URLs
VITE_CORE_URL=http://localhost:3000

# 5. Default Tenant & Zoning
DEFAULT_TENANT_ID=01955b25-4c07-7e61-8cf3-1fcfbf5f9175
ZONE_ID=zone-01
```

> [!WARNING]
> Never commit `.env` or production credentials into source control. Always rotate `NEXTAUTH_SECRET` in production environments.

---

## 4. Pre-Deployment Checklist

Before deploying updates or running database migrations, execute the following safety checklist:

### Step 1: Execute Full Database Backup
Always capture an authoritative schema + data snapshot:
```bash
./scripts/backup-db.sh
```
This produces timestamped dumps in `backups/`:
- `sails_schema_YYYYMMDD_HHMMSS.sql` (schema structure, indexes, FKs, RLS policies)
- `sails_data_YYYYMMDD_HHMMSS.sql` (data with COPY commands and trigger bypass)

### Step 2: Verify Zero Prisma Schema Drift
Confirm that local Prisma schema matches the live database:
```bash
docker exec sails-core sh -c "cd packages/core && bun x prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script"
```
*Expected output*: `-- This is an empty migration.`

### Step 3: Check Package Dependencies & Clean Workspaces
```bash
bun install
bun pm dedupe
```

---

## 5. Deployment Procedures

### A. Initial Fresh Deployment

1. **Clone repository and configure `.env`**:
   ```bash
   git clone <repo_url> "Sails Platform"
   cd "Sails Platform"
   cp .env.example .env # or configure .env
   ```

2. **Build and start containers with Bun 1.4**:
   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

3. **Verify running services**:
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```
   *Expected containers*: `sails-db`, `sails-core`, `sails-console`.

4. **Initialize Core Database & Run Migrations**:
   ```bash
   docker exec sails-core sh -c "cd packages/core && bun x prisma migrate deploy"
   docker exec sails-core sh -c "cd packages/core && bun x prisma generate"
   ```

5. **Provision Initial Root Tenant (if empty DB)**:
   ```bash
   docker exec sails-core sh -c "cd packages/core && bun run cli tenant:create \"Default Organization\" admin@klao.app"
   ```

---

### B. Standard Rolling Upgrade / Container Update

> [!IMPORTANT]
> **Golden Rule**: Never run `docker restart sails-core` to apply changes. Bun dev containers can fail on in-place restart. Always remove and recreate the container:

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild container images
docker compose build --no-cache

# 3. Cleanly recreate containers
docker compose down
docker compose up -d

# 4. Generate updated Prisma client
docker exec sails-core sh -c "cd packages/core && bun x prisma generate"

# 5. Check live health logs
docker logs sails-core --since 2m
```

---

## 6. Disaster Recovery & Database Restoration

If restoring a database snapshot from `backups/`:

1. **Stop core API to terminate active connection pools**:
   ```bash
   docker stop sails-core
   ```

2. **Restore schema structure**:
   ```bash
   docker exec -i sails-db psql -U postgres -d postgres < backups/sails_schema_YYYYMMDD_HHMMSS.sql
   ```

3. **Restore data**:
   ```bash
   docker exec -i sails-db psql -U postgres -d postgres < backups/sails_data_YYYYMMDD_HHMMSS.sql
   ```

4. **Regenerate Prisma Client & restart Core API**:
   ```bash
   docker start sails-core
   docker exec sails-core sh -c "cd packages/core && bun x prisma generate"
   ```

---

## 7. Platform Deployment Golden Rules

1. **Never put writes, seeds, or auto-repair logic inside API GET handlers.** All DDL and menu configurations belong in migration files or CLI scripts.
2. **Always use CUID / Time-Ordered IDs (`VARCHAR(30)`)** for primary keys. Never use `UUIDv4` (`gen_random_uuid()`) to prevent B-Tree index fragmentation under high volume.
3. **Audit logs must be dispatched asynchronously** outside the main transaction.
4. **Preserve `klaoplatform_pgdata` external volume** — never prune or delete without verified backups.
5. **Always verify Bun 1.4 baseline** across containers via `docker exec sails-core bun --version`.
