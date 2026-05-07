---
description: Rebuild Test Tenant
---

# Rebuild Test Tenant Workflow (API-Based)

This workflow resets the KLAO platform to a clean state and re-provisions the default test tenant with standard apps and navigation, executing primarily through the platform's REST APIs.

## Prerequisites
- Docker must be installed and running.
- The `klao-core` service should be up and reachable at `http://localhost:3000`.

## Steps

### 1. Database Cleanup & Tenant Provisioning (Phase 1)
Drops all physical schemas, clears metadata, and provisions a new tenant via `POST /api/tenant/provision`.

// turbo
`docker exec klao-core bun run platform:reset --phase 1`

### 2. Restart Core Service
Restart the container to ensure the newly created `DEFAULT_TENANT_ID` in `.env` is loaded into the Next.js process for subsequent authenticated API calls.

// turbo
`docker compose restart core`

### 3. Seed Apps & Menus via API (Phase 2)
Creates all standard applications and navigation items as defined in `docs/CREATE_APP_NAV.md` using `POST /api/console/apps` and `POST /api/console/menus`.

// turbo
`docker exec klao-core bun run platform:reset --phase 2`

## Verification
- Verify the console output for Phase 2 displays successful creation of all 4 standard apps (Sales, Sales Manager, Marketing, Services).
- Open the KLAO Console and verify the App Switcher and Sidebar match the documentation.