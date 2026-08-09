# Plugin System

SAILS Platform supports three tiers of Workflow Event plugins, plus Field Type and Web Control plugins (Console).

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│  @sails/plugin-sdk (npm / workspace package)              │
│  ─ The ONLY dependency a plugin developer installs ─      │
│  • WorkflowEventPlugin interface                          │
│  • WorkflowEventContext / WorkflowEventResult types       │
│  • PluginSDK type (DI contract for third-party plugins)   │
│  • WorkflowEventRegistry singleton (register + resolve)   │
└───────────────────────────────────────────────────────────┘
        ▲                          ▲
        │                          │
   ┌────┴──────────┐    ┌──────────┴───────────────────┐
   │ First-party   │    │  Third-party                 │
   │ (compile-time)│    │  (runtime — /plugins/ volume)│
   │               │    │                              │
   │ Imports from  │    │  Receives PluginSDK via      │
   │ sails-core    │    │  register(api) — never       │
   │ directly.     │    │  imports core internals.     │
   │               │    │                              │
   │ Example:      │    │  Example:                    │
   │ @sails/plugin │    │  /plugins/my-event/          │
   │ -record-event │    │    index.js                  │
   └───────────────┘    └──────────────────────────────┘
```

## Tier 1 – Built-in Plugins (First-party, compile-time)

Reside in `packages/core/src/core/engine/WorkflowEventPlugins.ts`. Each plugin self-registers into the SDK registry at import time:

```typescript
// Notification, Approval, Expression, Transform, Script
const notificationEventPlugin: WorkflowEventPlugin = { type: 'notification', ... };
workflowEventRegistry.register(notificationEventPlugin);
```

These plugins have full access to core internals (`db`, `pool`, `QueryLayer`, helpers) through standard module imports. They are the canonical built-in event types shipped with every SAILS deployment.

**Built-in plugin list:**

| Type | Plugin | Description |
|------|--------|-------------|
| `approval` | `approvalEventPlugin` | Task approval with assignees |
| `transform` | `transformEventPlugin` | JSONata data transformation |

## Tier 2 – First-party External Plugins (Workspace packages)

Reside in separate workspace packages under `packages/`. The reference implementation is `@sails/plugin-record-event`.

| Type | Plugin | Package |
|------|--------|---------|
| `record` | `recordEventPlugin` | `@sails/plugin-record-event` |
| `notification` | `notificationEventPlugin` | `@sails/plugin-notification` |
| `expression` | `expressionEventPlugin` | `@sails/plugin-expression` |
| `script` | `scriptEventPlugin` | `@sails/plugin-script` |

These plugins import infrastructure from `sails-core` (because they live in the monorepo). Core imports all 6 packages as a side-effects at startup (`initPlugins()`), which triggers self-registration via `workflowEventRegistry.register()`.

## Tier 3 – Third-party Plugins (Runtime, filesystem-based)

Third-party plugins are loaded from the `/plugins/` directory (configurable via `PLUGINS_DIR` env var) at startup by `core/src/core/plugins/loader.ts`.

Startup flow:
```
WorkflowEngine.ts imports init.ts
  └─ initPlugins() auto-runs:
       ├─ 1. Built-in plugins self-register (Tier 1)
       ├─ 2. First-party external plugins self-register (Tier 2)
       └─ 3. loadThirdPartyPlugins() scans /plugins/ (Tier 3)
            └─ For each directory:
                 const plugin = require(`${pluginPath}/index.js`);
                 plugin.register(api);  // api = PluginSDK
```

A third-party plugin directory looks like:
```
/plugins/
└── my-record-event/
    ├── index.js          ← entry point
    └── helpers.js        ← optional
```

### Writing a Third-party Plugin

1. **Install the SDK:**
   ```bash
   npm install @sails/plugin-sdk
   ```

2. **Write the plugin** (TypeScript, compile to JS):
   ```typescript
   import type { PluginSDK, WorkflowEventPlugin, WorkflowEventContext, WorkflowEventResult } from '@sails/plugin-sdk';

   export function register(api: PluginSDK): void {
     const plugin: WorkflowEventPlugin = {
       type: 'my-record-event',
       label: 'My Record Event',
       description: 'Custom record CRUD executor',
       parametersSchema: [
         {
           label: 'Action',
           parameters: [
             { name: 'model', type: 'model_select', label: 'Model', required: true },
             { name: 'operation', type: 'operation_select', label: 'Operation' },
           ],
         },
       ],
       async execute(ctx: WorkflowEventContext): Promise<WorkflowEventResult> {
         // Use api.query.* for record CRUD (RLS-enforced)
         // Use api.helpers.* for evaluateJsonata, resolveTenantSchema, etc.
         // Use api.db / api.pool for direct database access

         const { query, helpers } = api;
         const schema = await helpers.resolveTenantSchema(ctx.tenantId);

         const result = await query.insertRecord(
           ctx.tableName!,
           ctx.tenantId,
           { name: 'example' },
           ctx.session,
         );

         return { success: true, output: { createdId: result.id } };
       },
     };

     api.registry.register(plugin);
   }
   ```

3. **Build a single JS file** (e.g., with esbuild):
   ```bash
   esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js
   ```

4. **Deploy**: copy `dist/` into `/plugins/my-record-event/` on the core container.

5. **Restart core**: `docker restart sails-core`

### PluginSDK Reference

| Property | Type | Description |
|----------|------|-------------|
| `api.registry.register(p)` | `(plugin: WorkflowEventPlugin) => void` | Register a plugin into the global registry |
| `api.query.insertRecord(...)` | `(...) => Promise<{ id: string }>` | Insert a record (RLS-enforced) |
| `api.query.updateRecord(...)` | `(...) => Promise<void>` | Update a record |
| `api.query.deleteRecord(...)` | `(...) => Promise<void>` | Delete a record |
| `api.query.upsertRecord(...)` | `(...) => Promise<{ id: string }>` | Upsert a record |
| `api.query.listRecords(...)` | `(...) => Promise<{ rows, total, page, limit }>` | List records with filters |
| `api.helpers.evaluateJsonata(expr, bindings)` | `(expr: string, bindings: any) => any` | Evaluate JSONata expression |
| `api.helpers.resolveTenantSchema(id)` | `(id: string) => Promise<string>` | Look up tenant schema name |
| `api.helpers.preprocessFilterGroups(filters, ctx)` | `(filters, ctx) => Promise<void>` | Resolve filter macros |
| `api.helpers.quoteIdent(name)` | `(name: string) => string` | Quote a SQL identifier |
| `api.helpers.genId(prefix)` | `(prefix: string) => string` | Generate a random ID |
| `api.helpers.logWfAction(...)` | `(...) => Promise<void>` | Write an audit log entry |
| `api.db` | `PrismaClient` | Direct Prisma client (type-erased) |
| `api.pool` | `pg.Pool` | Raw PostgreSQL pool |

## Event Migration Status

All 6 workflow event types are migrated:

| Event Type | Status | Location |
|-----------|--------|----------|
| `record` | Externalized | `packages/plugin-record-event/` |
| `notification` | Externalized | `packages/plugin-notification/` |
| `expression` | Externalized | `packages/plugin-expression/` |
| `script` | Externalized | `packages/plugin-script/` |
| `approval` | Externalized | `packages/plugin-approval/` |
| `transform` | **Removed** | Duplicate of `expression` (same JSONata logic) |

All 6 plugins self-register into the same `workflowEventRegistry` singleton from `@sails/plugin-sdk`. The engine (`WorkflowEngine.fireStageEvents()`) resolves all of them uniformly via `workflowEventRegistry.getPlugin(event.type)`.

## File Layout

```
packages/
├── plugin-sdk/                          # @sails/plugin-sdk
│   ├── package.json
│   └── src/
│       ├── index.ts                     # Public API re-exports
│       ├── types.ts                     # WorkflowEventPlugin, PluginSDK, contexts
│       └── registry.ts                  # WorkflowEventRegistry singleton
│
├── plugin-record-event/                 # @sails/plugin-record-event (reference)
│   ├── package.json
│   └── src/
│       ├── index.ts                     # Self-registers via workflowEventRegistry
│       └── RecordEventPlugin.ts         # Executor logic
│
├── plugin-notification/                # @sails/plugin-notification
│   ├── package.json
│   └── src/
│       ├── index.ts                     # Self-registers
│       └── NotificationEventPlugin.ts   # Executor (bell / email delivery)
│
├── plugin-expression/                  # @sails/plugin-expression
│   ├── package.json
│   └── src/
│       └── index.ts                     # Self-registers via makeJsonataEvent factory
│
├── plugin-script/                      # @sails/plugin-script
│   ├── package.json
│   └── src/
│       ├── index.ts                     # Self-registers
│       └── ScriptEventPlugin.ts        # BYOC sandbox executor
│
├── plugin-approval/                    # @sails/plugin-approval
│   ├── package.json
│   └── src/
│       ├── index.ts                     # Self-registers
│       └── ApprovalEventPlugin.ts      # Executor (task assignment + notification)
│
└── core/
    └── src/core/
        ├── engine/
        │   ├── WorkflowEngine.ts         # Imports init — triggers registration
        │   └── WorkflowEventPlugins.ts   # 5 built-in plugins + shared helpers
        └── plugins/
            ├── init.ts                   # Startup: loads all 3 tiers
            └── loader.ts                 # buildPluginSDK() + loadThirdPartyPlugins()
```

## Production Deployment

1. **Core Docker image** ships with:
   - Built-in plugins (Tier 1, compiled in)
   - First-party external plugins (Tier 2, workspace packages, compiled in)
   - The plugin loader (scans `/plugins/` volume at startup)
   - An empty `/plugins/` directory (mount point for Tier 3)

2. **Adding a third-party plugin**:
   - Drop the compiled `.js` file(s) into the mounted `/plugins/` directory
   - Restart the core container (`docker restart sails-core`)
   - No rebuild or redeploy of the core image needed

3. **Adding a first-party external plugin**:
   - Create the workspace package under `packages/`
   - Add it to core's `package.json` dependencies
   - Import and call `register()` in `init.ts`
   - Rebuild the core Docker image (standard deploy cycle)

## Console Integration (Work in Progress)

Currently, event configs are imported from `@sails/shared` at compile time. Phase 2 will serve event configs from the API so new event types (with standard parameter types) appear in the console wizard without a console rebuild. See `docs/PLUGIN_PLATFORM_ROADMAP.md` for the full roadmap.
