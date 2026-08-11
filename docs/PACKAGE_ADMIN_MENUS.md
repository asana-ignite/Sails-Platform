# Package Admin Menus

Package-scoped admin menus allow optional add-on packages (Sales, Customer Service, Marketing, etc.)
to add their own configuration sections under the **Settings & Admin** app — at runtime, without a
platform redeploy.

This mirrors the Salesforce Setup model: all administration lives under one app, with
package-specific sections appearing only when the package is licensed for the tenant.

## Architecture

```
                    ┌── compile-time (deployed once) ──┐
                    │  PACKAGE_MANIFESTS               │  ← shared/src/packages.ts
                    │  registry.tsx                    │  ← lazy component imports
                    │  pages/admin/{package}/*.tsx     │  ← admin page components
                    └──────────────────────────────────┘
                              │
                    ┌── runtime (DB, per-tenant) ──┐
                    │  capability_definitions       │  ← what capabilities exist
                    │  console_menus                │  ← which admin sections show
                    │  system_permissions           │  ← who can access what
                    └──────────────────────────────┘
```

**Key principle:** Components are always in the bundle (compile-time), but they're gated by DB records. Adding a package doesn't require a redeploy — the code was already shipped in the last build.

## Adding a New Package

### Step 1 — Add the package manifest

File: `packages/shared/src/packages.ts`

```typescript
export const PACKAGE_MANIFESTS: Record<string, PackageManifest> = {
  // ... existing entries ...

  marketing: {
    id: 'marketing',
    name: 'Marketing',
    icon: 'Megaphone',
    description: 'Campaign management, email marketing, and analytics',
    category: 'Marketing Configuration',          // sidebar section label
    capabilities: [
      {
        key: 'package.marketing.config.campaigns',
        label: 'Manage Campaigns',
        description: 'Create and manage marketing campaigns.',
      },
      {
        key: 'package.marketing.config.templates',
        label: 'Manage Email Templates',
        description: 'Design and manage email templates.',
      },
    ],
    adminMenus: [
      {
        label: 'Campaigns',
        icon: 'Megaphone',
        path: '/admin/marketing/campaigns',
        componentKey: 'MarketingCampaignsAdmin',
        requiredCapability: 'package.marketing.config.campaigns',
      },
      {
        label: 'Email Templates',
        icon: 'Mail',
        path: '/admin/marketing/templates',
        componentKey: 'MarketingTemplatesAdmin',
        requiredCapability: 'package.marketing.config.templates',
      },
    ],
  },
};
```

### Step 2 — Create admin page components

File: `packages/console/src/pages/admin/marketing/MarketingCampaignsAdmin.tsx`

```tsx
import React from 'react';

const MarketingCampaignsAdmin: React.FC = () => {
  return (
    <div className="sails-admin-content">
      <section className="sails-page-header">
        <h1 className="sails-page-header__title">Campaigns</h1>
        <p className="sails-page-header__subtitle">
          Create and manage marketing campaigns.
        </p>
      </section>
      {/* Your admin UI here */}
    </div>
  );
};

export default MarketingCampaignsAdmin;
```

### Step 3 — Register components

File: `packages/console/src/features/admin/registry.tsx`

```typescript
// Marketing Package Admin
MarketingCampaignsAdmin:  lazy(() => import('../../pages/admin/marketing/MarketingCampaignsAdmin')),
MarketingTemplatesAdmin:  lazy(() => import('../../pages/admin/marketing/MarketingTemplatesAdmin')),
```

### Step 4 — Deploy and seed capabilities

After deploy, seed the capability definitions globally (once, idempotent):

```bash
bun run cli package:seed marketing
```

### Step 5 — Activate for a tenant

When a customer buys the Marketing license, activate it for their tenant:

```bash
bun run cli package:activate <tenantId> marketing
```

Or via API (requires admin session):

```http
POST /api/tenant/packages/activate
{ "packageId": "marketing" }
```

This does two things:
1. Upserts `capability_definitions` rows (global, idempotent)
2. Inserts `console_menus` rows under the tenant's Settings & Admin app

## Activation Flow (Runtime)

```
Tenant buys license
  ↓
POST /api/tenant/packages/activate { packageId: "marketing" }
  ↓
1. capability_definitions upserted (global, idempotent)
2. console_menus inserted under Settings & Admin for this tenant
  ↓
Admin visits Permissions → assigns capabilities to a team
  ↓
Team members see "Marketing Configuration" in sidebar
```

**Idempotent:** Running activation twice for the same tenant is a no-op. The provisioner checks if the section already exists before creating.

## Listing Active Packages

```bash
bun run cli package:list          # shows all available packages with capabilities

# Or via API:
GET /api/tenant/packages          # returns all packages with activation status per tenant
```

## Capability Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `system.{resource}.{action}` | `system.users.manage` | Core platform capabilities (compile-time registry) |
| `package.{slug}.{resource}.{action}` | `package.sales.config.targets` | Package-specific capabilities (DB-driven, runtime) |

Package capabilities live in two places:
- **`PACKAGE_MANIFESTS`** (compile-time, shared/src/packages.ts) — defines what each package offers
- **`capability_definitions`** DB table — the runtime authoritative source for authorization

Admin users automatically get all capabilities (system + all package caps from DB). Regular users only get capabilities explicitly assigned to their teams via `system_permissions` records.

## Permission Assignment

The existing **Teams → Capabilities** tab in `AdminTeamManager` fetches capabilities from `GET /api/console/permissions`, which returns a merged view of system + package capabilities. No UI changes needed — package capabilities appear automatically alongside system capabilities.

## Relationship to Existing System

| System | Use |
|--------|-----|
| `SYSTEM_PERMISSION_REGISTRY` (compile-time) | Core platform capabilities that every tenant needs. Never uninstalled. |
| `PACKAGE_MANIFESTS` (compile-time) | Defines what packages exist and their capabilities. Deployed once. |
| `capability_definitions` (DB, runtime) | Authoritative source for all capabilities at runtime. Seeded from both registries. |
| `GUIDE_CUSTOM_PLUGINS.md` | How to build a single custom admin page. | 
| This doc | How to build an entire package with multiple admin pages, capabilities, and activation flow. |

## Files Reference

| File | Role |
|------|------|
| `shared/src/packages.ts` | `PACKAGE_MANIFESTS` registry — define packages and their capabilities |
| `core/prisma/schema.prisma` | `CapabilityDefinition` model |
| `core/src/services/TenantProvisioner.ts` | `activatePackage()`, `getActivePackages()`, `seedPackageCapabilityDefinitions()` |
| `core/src/app/api/tenant/packages/route.ts` | `GET /api/tenant/packages` — list packages |
| `core/src/app/api/tenant/packages/activate/route.ts` | `POST /api/tenant/packages/activate` — activate a package |
| `core/src/app/api/console/permissions/route.ts` | Returns merged system + package capabilities |
| `core/src/app/api/console/config/route.ts` | Resolves admin capabilities from DB for authorization |
| `console/src/features/admin/registry.tsx` | Register package admin components |
| `console/src/pages/admin/{package}/*.tsx` | Package admin page components |
| `core/src/cli/sails-cli.ts` | `package:seed`, `package:activate`, `package:list` commands |
