# SAILS — Third-Party Plugin Platform Roadmap

**Owner:** Platform Architect (contract/SDK), Backend Engineer (registry + install flow), Database Engineer (metadata + provisioning), Frontend Engineer (runtime loader + Admin UI), QA Tester (verification).

This document defines the strategic roadmap for a **Third-Party Plugin Platform** on SAILS: letting partners and customers author, package, and deploy plugins — **field types, controls, admin menu options, and data models** — into individual tenants without redeploying the platform.

---

## 1. Product Goal

- **Who builds plugins:** SAILS team (internal), vetted partners, and self-serve customers.
- **What a plugin contributes:** one or more of — field types, field controls, admin/menu pages, and data-model blueprints.
- **How it's deployed:** a packaged plugin bundle is installed per-tenant from the SAILS Console, with versioning, capability gating, and (for external publishers) a review gate.
- **Non-negotiable boundary:** plugins must never bypass the SAILS security pipeline (RLS/RBAC) and must never require a platform redeploy to install.

---

## 2. Current State (why this is a real project)

Every plugin surface is **compile-time** today — adding one means editing the platform source and redeploying:

| Surface | Registry | Location |
|---|---|---|
| Field types (backend: DDL + Zod) | `FieldRegistry` | `packages/core/src/core/registry/FieldRegistry.ts` |
| Field controls (frontend: React) | `FieldControlRegistry` | `packages/console/src/features/controls/FieldControlRegistry.ts` |
| Admin / menu plugins (frontend: React) | `AdminPluginRegistry` | `packages/console/src/features/admin/registry.tsx` |

Additional observations:
- `AdminByocModules.tsx` is a **14-line stub** — no runtime plugin mechanism, no plugin database, no marketplace.
- The current backend contract **leaks React into the core package**: `FieldTypePlugin` declares `RenderFormInput`/`RenderTableCell` (`packages/core/src/core/registry/FieldTypePlugin.ts:13-14`). This must be untangled — backend keeps only DDL-safe metadata; UI moves entirely to the frontend SDK.
- The platform already has useful mounting infrastructure to build on:
  - `componentKey` + `ConsoleMenu` → menu items resolve to runtime components.
  - `AppPluginShell` handles `actionType === 'plugin'` routes (`docs/SITE_STRUCTURE.md:8`).
  - `TenantProvisioner` / `TranslatorLayer` sync metadata blueprints → physical tables (RLS automatic).
  - `React.lazy()` + `Suspense` are already the SPA loading pattern.

---

## 3. Target Architecture

A **runtime plugin system** split into a safe declarative backend contract and a bundled frontend. Plugin code is **never executed inside the API process**.

### 3.1 Plugin manifest (`plugin.json`) + SDK (`@sails/plugin-sdk`)

```
{
  "id": "acme-vat",
  "name": "ACME VAT Suite",
  "version": "1.2.0",
  "vendor": "ACME Ltd",
  "trustTier": "partner",
  "requiredCapabilities": [],
  "fieldTypes": [ { "type": "vat_number", "label": "VAT Number",
                    "physicalType": "text", "iconName": "BadgePercent",
                    "parametersSchema": [ ... ] } ],
  "controls": [ { "id": "control:vat_input", "compatibleTypes": ["vat_number"], ... } ],
  "menus":     [ { "label": "VAT Reports", "icon": "PieChart", "componentKey": "AcmeVatReports", "path": "/dashboard/vat" } ],
  "dataModels":[ { "table": "tax_accounts", "fields": [ ... ] } ]
}
```

- `fieldTypes[].physicalType` is **restricted to a whitelist** — `text`, `number`, `date`, `boolean`, `jsonb` — so DDL generation stays inside `AlchemaCore` and remains injection-proof (as today).
- `parametersSchema` follows the exact shape already used in `packages/shared/src/fieldTypes.ts`.
- Validation is **declarative** (rules → `core.fields` + `zodGenerator`), never executable code.
- The SDK provides the TypeScript types for this manifest and the plugin contribution contract, all derived from `@sails/shared`.

### 3.2 Plugin registry (new, in `core` DB)

New Prisma models (`@@schema("core")`, mirroring `ConsoleApp`):

- `Plugin` — id, `pluginId`, version, vendor, bundleUrl, bundleHash, manifest Json, `trustTier` (`internal` | `partner` | `self-serve`), `reviewStatus` (`draft` | `pending` | `approved` | `rejected` | `published`), `isSystem`, timestamps.
- `TenantPluginInstall` — tenantId, pluginId, `config Json`, enabled, `requiredCapability`, installedAt, installedBy.
- `PluginFieldType` / `PluginContribution` — the resolved field types, controls, and data models a plugin contributes (denormalized for fast lookup by registries).

### 3.3 Install flow (per tenant)

1. Publisher creates a release → automated security scan → (partner/self-serve) human review gate → `published`.
2. Tenant admin installs from Console (`AdminByocModules` rebuilt): 
   - Insert `TenantPluginInstall`.
   - Provision contributed data models via `TenantProvisioner` (existing metadata→DDL sync; RLS policies applied automatically).
   - Register menus via `ConsoleMenu` with `componentKey` (per `docs/CREATE_APP_NAV.md`).
3. Console runtime loads the bundle (loader choice in §5) and merges the plugin's field types/controls/menus into the registries.
4. Uninstall = revoke `TenantPluginInstall` + drop contributed tables + remove menus (explicit action; never inside a GET handler — golden rule #1).

### 3.4 Security invariants (non-negotiable)

- **No server-side plugin code execution.** DDL from whitelisted physical types only.
- Plugin data models live in tenant schemas → **RLS/RBAC apply automatically**.
- Provisioning/uninstall are explicit actions or scripts — **never write/seed inside runtime GET handlers** (`AGENTS.md` golden rule #1).
- Version pinning via **bundle hashes**; tampered/unknown-hash bundles are rejected.
- Client-side: CSP, no `eval`, capability gating, and a trust-tier warning for non-internal plugins.
- New schema ships as Prisma migrations; verify zero drift with `prisma migrate diff`.

---

## 4. Trust Model — all publisher models coexist

A per-release `trustTier` + `reviewStatus` lets internal, partner, and self-serve models live side by side. The **per-tenant install flow is identical** across tiers; only the publish gate and runtime posture differ.

| Tier | Publisher | Publish gate | Runtime posture |
|---|---|---|---|
| `internal` | SAILS team | none (`isSystem`) | full trust |
| `partner` | vetted partners | automated security scan **+ human review** before tenants can install | verified badge, standard sandbox |
| `self-serve` | any customer | allowed only if platform policy/plan permits | stricter CSP, explicit trust warning, `requiredCapability` gating |

---

## 5. Decision — Frontend bundle loading (both options documented)

The SDK contract is built around a `registerPlugin(api)` call so the **loader is an internal detail** — plugins do not care which approach is used.

### Approach 1 — Dynamic `import()` of a static ESM bundle (recommended for v1)

The plugin is built (Vite/Rollup) as a single ESM file with `react`, `react-dom`, `lucide-react`, and `@sails/shared` **externalized** to shared globals. The Console loads it lazily and calls `registerPlugin()`.

- **Use cases:** tens of plugins; per-tenant direct install; simple URL+hash versioning; MVP; plugins that should load only when their menu opens (e.g., a partner's "GIS Map" admin page).
- **Pros:**
  - Trivial to implement — no Console build-infrastructure changes.
  - Module-boundary isolation; one plugin can't import another's internals.
  - Add/remove/version via static URL + content hash.
  - Reuses the existing `React.lazy()` / `componentKey` mount points.
- **Cons:**
  - React must be externalized correctly, or you hit "Invalid hook call" / two-React issues.
  - Shared libs other than the externals get duplicated per plugin → larger downloads.
  - No runtime version negotiation between host and plugin.

### Approach 2 — Module Federation (Vite `@originjs/vite-plugin-federation`)

The Console (host) and each plugin (remote) share singletons (`react`, shared kernel) with **semantic-version negotiation** at runtime — a plugin built against shared v1 keeps working when the host upgrades to v2.

- **Use cases:** hundreds of plugins; fast-moving shared kernel; app-store-scale ecosystem (e.g., 50 partner dashboards all sharing the analytics chart kernel, upgraded independently).
- **Pros:**
  - One React instance; deduplicated shared libraries; smaller payloads.
  - Vendor-independent updates; resilient to shared-kernel evolution.
  - Standard for micro-frontend ecosystems.
- **Cons:**
  - Significant build complexity in both Console and the plugin template.
  - Harder runtime hardening and version-matrix debugging.
  - Steeper learning curve for third-party authors.

**Recommendation:** start with **Approach 1** (sufficient for per-tenant install of tens of plugins); migrate to **Approach 2** at the marketplace phase without changing plugin source code (the `registerPlugin` API abstracts the loader).

---

## 6. Decision — Backend plugin logic (all options documented)

### Option A — Declarative only (metadata + validation + data models)

- **What plugins can do:** field types (whitelisted physical types), validation rules, UI controls/menus, and data-model blueprints — all expressed as data.
- **Sample:** a "VAT" plugin contributes a `vat_number` field type (physicalType `text`, regex validation, country-dropdown params) plus a `tax_accounts` data-model blueprint.
- **Pros:** zero code-execution risk; fast; upgrades never break; RLS guaranteed; matches the config-first positioning; easy QA.
- **Cons:** no custom write-time logic; complex behaviors need formula/expression workarounds, declarative workflow rules, or external services.

### Option B — Sandboxed in-process code (`isolated-vm` / WASM)

- **What it enables:** full lifecycle hooks (before/after create/update/delete), arbitrary computed fields, external API calls, notifications.
- **Sample:** a "Commission" plugin hooks `after_update` on deals: `if (deal.stage === 'Won') commissionCalculator.enqueue(deal);`.
- **Pros:** maximum partner flexibility; compute on-platform.
- **Cons (real and heavy):**
  - Building a hardened sandbox is a serious project — runaway loops, memory, denial-of-service, VM escapes.
  - Plugins may only be granted a narrow whitelisted API that does **safe CRUD through `QueryLayer` under RLS** — never raw SQL — and that API must be designed and audited.
  - In-process execution can block the API unless strictly time-boxed.
  - Heavy QA and upgrade burden (this is the Salesforce Apex / Shopify Functions class of investment).

### Option C — Outbound webhooks to partner-hosted endpoints (recommended middle ground)

- **What it enables:** plugins register lifecycle webhooks (create/update/delete) that SAILS fires with **signed payloads** to the partner's own endpoint; the partner runs logic on *their* infrastructure.
- **Sample:** a "CRM Sync" plugin receives a signed `deal.created` webhook at `https://partner.io/hooks/sails` and mirrors it to their ERP.
- **Pros:** code never touches your DB or API process; RLS unaffected; reuses the existing `system.integrations.api` capability; covers ~90% of lifecycle-logic use cases (external sync, notifications, enrichment).
- **Cons:** requires the partner to host an endpoint; network latency per event; needs retry/offline semantics and signature validation.

**Recommendation:** **Option A + Option C in v1** (declarative contributions + outbound webhooks). Defer **Option B** to a later phase gated on demonstrated partner demand.

---

## 7. VS Code Extension — verdict

A VS Code extension is **not required** for the platform — it is pure developer experience. The roadmap therefore:

- **P4 — CLI + starter template first:** `npx @sails/create-plugin`, `sails-plugin validate`, `sails-plugin build`, `sails-plugin publish`. This alone lets partners scaffold, type-check against `@sails/shared`, bundle, and upload.
- **P4.5 — VS Code extension (optional, after the runtime exists):** wraps the CLI with scaffold commands, manifest validation, local preview against a dev Console container, and one-click publish.

**Rule:** never build editor tooling before the runtime exists, or you are building tooling against a moving target.

---

## 8. Phasing

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1** | Contract + SDK: split backend/frontend contract; untangle React out of core field plugins; define `plugin.json` + SDK types; physical-type whitelist | `@sails/plugin-sdk` published; built-in plugins and SDK share one contract |
| **P2** | Runtime loading: ESM loader (Approach 1); registries (`FieldRegistry`, `FieldControlRegistry`, `AdminPluginRegistry`) merge built-ins + installed plugins from DB | Console renders a plugin's control and admin page from metadata alone |
| **P3** | Registry + install: `Plugin`/`TenantPluginInstall` models; publish/install APIs; rebuilt `AdminByocModules`; data-model provisioning on install; trust-tier + review gates; capability gating | Install/uninstall lifecycle works end-to-end for one partner plugin |
| **P4** | Authoring DX: starter template + CLI (`validate`/`build`/`publish`) | A partner scaffolds, builds, and publishes without platform changes |
| **P4.5** | VS Code extension wrapping the CLI | Local preview + one-click publish from VS Code |
| **P5** | Public marketplace (only then: Module Federation migration, catalog, vendor accounts, review workflow, versioning) | Self-serve installation from a catalog across tenants |

---

## 9. Verification

New **non-destructive** test suite `packages/core/tests/test-plugin-registry.ts` (run only on a throwaway DB — `AGENTS.md` golden rule #6):

- Install/uninstall lifecycle: install provisions tables/menus; uninstall removes them cleanly.
- RLS: plugin-contributed data models honor tenant isolation.
- Physical-type whitelist: a manifest with a non-whitelisted type is rejected.
- Capability gating: users without the required capability cannot install or view plugin features.
- Trust tiers: `self-serve`/`partner` releases blocked until the review gate passes.
- Bundle tamper: a bundle with an unknown/mismatched hash is rejected.
- Webhook signatures: unsigned/invalid payloads rejected (Option C).

---

## 10. Open Questions / Future Work

- Sandboxed in-process code (**Option B**) — revisit when partner demand justifies it.
- Public marketplace (**P5**) — catalog, monetization, review workflow, Module Federation migration.
- Analytics interplay — plugin data models automatically become queryable datasets for the Analytics platform (`docs/ANALYTICS_ROADMAP.md`).
