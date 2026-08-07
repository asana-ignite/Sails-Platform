# Workflow Studio — Workflow Event Plug-In & BYOC Scripts

Design blueprint for the Workflow Event Plug-In system and how tenant
admins extend it with BYOC scripts.

## 1. Concept

A workflow (Routing Process) is a DAG of **stages**. Each stage runs an
ordered list of **Workflow Events** when a record enters it. The event is the
unit of automation inside a stage — everything the stage does is one of these
event types.

The palette of event types is **compile-time** (like `FieldRegistry`). What
admins create at runtime are **configurations** of those types (like
`FieldDefinition` rows).

## 2. Workflow Event Types (built-in registry)

| Type | Label | Purpose |
|---|---|---|
| `record` | Record Event | Full CRUD on a model (create / read / update / delete / list) via QueryLayer (RLS-enforced); results stored into collection workflow variables with field mapping |
| `notification` | Notification | Bell / Email delivery |
| `approval` | Task Approval | Assign approval task to a router (user / team / position / role / record field) |
| `expression` | Expression Event | JSONata compute (condition / assignment) |
| `transform` | Transform Event | JSONata mapping |
| `script` | Script Event | Execute a tenant BYOC script in a sandbox |

The `script` type is the BYOC extension point. It is a built-in event type;
each admin-authored script is a **configuration** of it.

> Every event type also declares a **configuration schema** (see
> §4a) — the single, platform-standard way its config is edited in the
> Workflow Studio UI. Adding an event type = schema + plugin; no per-type
> UI code is required.

## 2b. Process Shape — Start Node, Implicit Completion

A workflow process in Workflow Studio has **no end node**:

- Every workflow begins at the **Start node** — a rectangle like a stage but
  without a router/team. It carries a Play icon and can hold Workflow Events
  (`startEvents` in the DAG) that fire when the workflow starts.
- The Start node has **connection ports** like a stage. Dragging a port onto a
  stage creates a **start branch** (`startBranches` in the DAG) — an explicit
  routing path with an optional condition. Without start branches, an implicit
  edge routes the flow to the first stage.
- **Completion is implicit**: when a stage has no outgoing path (no branches,
  or branches whose target is `completed`), the flow completes. Nothing is
  drawn — the "no next path" state *is* the end.
- In the DAG: `{ startEvents: [], startBranches: [], stages: [...] }`.
  Branches with `targetType: 'completed'` render no edge.

## 3. Option A — Registry vs Configuration

Two layers, kept strictly separate:

```
WorkflowEventRegistry (compile-time, shared kernel)
  register(RecordEventPlugin)
  register(NotificationEventPlugin)
  register(ApprovalEventPlugin)
  register(ExpressionEventPlugin)
  register(TransformEventPlugin)
  register(ScriptEventPlugin)          ← the only BYOC-facing type

core.record_scripts (runtime, per-tenant configurations)
  "Calculate Risk Score"  → scriptCode: ctx.record.values.score = ...
  "Send to ERP"           → scriptCode: sails.http.post(...)
  "Validate Compliance"   → scriptCode: if (!ok) throw new Error(...)
```

- Adding a new event **type** requires platform code (registry) — same bar as
  adding a field type.
- Adding a new script is data: a row in `core.record_scripts` + a
  `{"type":"script","config":{"scriptId":...}}` event in the DAG.

## 4. Plugin Interface

```ts
// packages/core/src/core/registry/WorkflowEventPlugin.ts
interface WorkflowEventPlugin {
  type: WorkflowEventType;                        // 'record' | 'notification' | ... | 'script'
  label: string;
  description: string;
  /** Configuration sections rendering this event type's configuration (shared schema). */
  parametersSchema: WorkflowEventConfigStep[];
  /** Executed by WorkflowEngine when the stage fires. */
  execute(ctx: WorkflowEventContext): Promise<WorkflowEventResult>;
}

interface WorkflowEventContext {
  tenantId: string;
  instanceId: string;
  stageId: string | null;
  tableName: string | null;
  recordId: string | null;
  /** The triggering record (populated by the Record Trigger hook). */
  record: { id: string | null; values: Record<string, any>; oldValues?: Record<string, any> } | null;
  operation: string | null;                       // 'create' | 'update' | 'delete' | null
  variables: Record<string, any>;                 // workflow variables (mutated via output)
  variableDefs?: any[];                           // declared variable shapes (collection structure)
  session: { userId: string; teamId: string | null };
  timing: 'stage_enter' | 'stage_exit';
  eventConfig: Record<string, any>;               // this event's configuration
}

interface WorkflowEventResult {
  success: boolean;
  output?: Record<string, any>;                   // merged back into ctx.variables
  error?: string;
}
```

Built-in plugins live in `packages/core/src/core/engine/WorkflowEventPlugins.ts`
and are registered in `WorkflowEventRegistry` at startup — mirroring
`FieldRegistry.ts`.

## 4a. Configuration Schema (the platform-standard config UI)

Every event type declares **how it is configured** as a schema of configuration
**sections** and typed **parameters** — the `FieldTypePlugin.parametersSchema`
pattern. The schema is the **single source of truth** shared by core and
console, in:

```
packages/shared/src/workflowEvents.ts  →  WORKFLOW_EVENT_CONFIGS
```

```ts
type WorkflowEventConfigParameterType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'select'
  | 'model_select' | 'operation_select' | 'filter_builder'
  | 'variable_auto_create' | 'field_mapping' | 'target_record'
  | 'variable_select' | 'expression_editor';

interface WorkflowEventConfigParameter {
  name: string;              // key inside the event's config JSON
  label: string;
  type: WorkflowEventConfigParameterType;
  defaultValue?: any;
  description?: string;
  placeholder?: string;
  required?: boolean;        // completion validation on Done
  options?: { label: string; value: string }[];  // for `select`
}

interface WorkflowEventConfigStep {
  label: string;             // e.g. "Model & Action", "Output & Mapping"
  parameters: WorkflowEventConfigParameter[];
}
```

The console renders this generically in
`packages/console/src/components/workflow/WorkflowEventWizard.tsx` — the same
**tabbed** interface for **every** event type. The interaction is uniform:

1. Double-click an event chip (canvas stage card, Start node, or properties
   list) → the event configuration opens directly.
2. The dialog is **tabbed**: **Tab 1 is always "Event"** (Name + Description);
   every further tab renders one schema section from the event type's config.
   The tab bar always shows, even for single-section events.
3. **Write-through editing** — every parameter edit lands directly in the
   live event config (no local draft). QueryStudio and the stage properties
   always see the current values, even before Done. The console snapshots the
   config when the wizard opens; **Cancel** restores it exactly (replace, not
   merge), **Done** just closes (already committed).
4. **Done** validates completion (required parameters, event name, record
   target-value context). On failure an inline error banner shows, red dots
   mark the offending tabs, and the first invalid tab is opened automatically.

Parameter type catalog:

| Type | Renders |
|---|---|
| `model_select` | Searchable model picker (`CustomSelect` of tables) |
| `operation_select` | Operation dropdown (create / read / update / delete / list) |
| `filter_builder` | QueryStudio `FilterBuilder` button + rule-count badge |
| `variable_auto_create` | Collection-variable name input + model column preview (read/list) |
| `field_mapping` | Side-by-side variable → column mapping: chips carry field-type icons and **connection ports** (variables = right port, columns = left port); drag a curvy line between two ports to connect/unmap (live dashed preview snaps green/red on compatible columns), Auto Map by name, per-panel A→Z / Z→A sorting and Clear All |
| `target_record` | Target selector (triggering record / variable / literal id) |
| `variable_select` | Variable dropdown when the sibling `targetType` is 'variable', else a text input |
| `expression_editor` | Opens the large JSONata expression editor modal |
| `text` / `textarea` / `number` / `boolean` / `select` | Standard platform controls |

### Record Event tabs (reference example)

| Tab | Parameters | Behavior |
|---|---|---|
| Event | name, description | always present — every event type |
| Model & Action | `model`*, `operation`, `filterGroups`, `targetType`, `targetValue` | model picker, operation select (**Create, Update, Upsert, Delete, Read, List**), QueryStudio filter for read/list/update/delete; **Target Record (ID)** group appears below for read/update/upsert/delete — which record the operation targets: triggering record / by variable / by literal id (*`targetValue` required when not `trigger`*; for upsert it selects the row to update when the id already exists) |
| Output & Mapping | `storeToVariable`, `fieldMapping` | read/list auto-create a **collection** workflow variable named after the event label (columns snapshotted from the model); create/update/upsert show the port-based field mapping panel |

\* `required: true` — completion is validated on Done.

### Record Event execution (full CRUD via QueryLayer)

The `record` plugin does **not** run raw SQL — it delegates every operation to
`QueryLayer` so RLS, audit logging, tenant scoping and filter handling are
enforced identically to the platform APIs:

| Operation | QueryLayer call | Notes |
|---|---|---|
| `read` | `listRecords(limit: 1, filters: {id: targetId})` | single record; `targetId` from `config.targetType`/`targetValue` (trigger default = `ctx.recordId`) |
| `list` | `listRecords(limit: 25, filterGroups: config.filterGroups)` | filter serialized via `serializeFilterGroups`, then enriched by `preprocessFilterGroups` (drill chains, record sources, macros) |
| `create` | `insertRecord(payload from fieldMapping)` | payload built from `{ sourceVar → targetCol }` mapping, values read from `ctx.variables` |
| `update` | `updateRecord(data from fieldMapping, targetId)` | target id resolved from `config.targetType`/`targetValue` |
| `upsert` | `upsertRecord(id, data from fieldMapping)` | `INSERT … ON CONFLICT (id) DO UPDATE` (PG 9.5+). Conflict id = a variable mapped onto the `id` column → else the Target Record selector → else generated (pure insert). Requires both create **and** update permissions; audit logs `CREATE` or `UPDATE`. `created_by`/`owner_id` are never overwritten on the update path |
| `delete` | `deleteRecord(targetId)` | same target resolution |

A `SessionContext` is built per-execution (role fetched from `core.users`).
Results are stored into the bound collection variable and validated against
its declared structure (`validateCollectionValue` in `@sails/shared`).

### QueryStudio Context source in workflows

Workflow Studio's two QueryStudio dialogs (Record Event filter + Record
Trigger condition) extend the **Context** source of the WHERE row with
workflow values, resolved **per instance at execution time**:

| Option | Macro | Resolves to |
|---|---|---|
| Requestor | `@wf.requestor` | `wf_instance.created_by` — the instance starter |
| Requestor → Name | `@wf.requestor.name` | starter's `core.users.name` |
| Requestor → Email | `@wf.requestor.email` | starter's email |
| Requestor → Role | `@wf.requestor.role` | starter's role (TENANT_ADMIN / MEMBER / …) |
| Requestor → Job Title | `@wf.requestor.title` | starter's `users.title` |
| Requestor → Team | `@wf.requestor.team` | starter's first `user_teams.team_id` (first-match, like `@my_team`) |
| Requestor → Position | `@wf.requestor.position` | starter's first `position_slots.position_id` |
| Request Date | `@wf.request_date` | `wf_instance.created_at` (ISO date) |
| `<variable> (<type>)` | `@var.<name>` | workflow variable value (scalars only; collections/records excluded) |

Mechanics: the Record Event plugin runs `preprocessFilterGroups` before SQL
generation (same pipeline as `/api/dynamic`), passing the actor session plus
a lazily-built workflow context (only when a rule references `@wf.*`/`@var.*`
— one `wf_instance` + one `core.users` lookup). This also makes standard
macros (`@today`, `@me`, …) and drill-chains work in the workflow path.
Other QueryStudio hosts (ObjectManager, LayoutStudio, list views) never
receive these options and resolve the same macros against the request
session — behavior unchanged.

## 4b. Partner Guide — Adding an Event Type

Adding a new Workflow Event type requires **two small pieces** — no per-type
UI code:

1. **Schema (shared)** — `packages/shared/src/workflowEvents.ts`:
   - add the type to `WorkflowEventType`
   - add `WORKFLOW_EVENT_CONFIGS[type]` — configuration sections + parameters
     (mark required parameters with `required: true` — they gate the Done
     completion validation)
2. **Plugin (core)** — `packages/core/src/core/engine/WorkflowEventPlugins.ts`:
   - implement `execute(ctx)` returning `WorkflowEventResult`
   - set `parametersSchema: WORKFLOW_EVENT_CONFIGS[type]`
   - add it to the `WorkflowEventPlugins` array (auto-registered)

The console renders the tabbed configuration automatically from the schema —
no changes in `WorkflowEventWizard.tsx` are needed unless the new type needs a
brand-new parameter type.

## 4c. Partner Guide — Adding a Parameter Type

When an existing or new event needs a control the catalog doesn't cover:

1. Add the value to `WorkflowEventConfigParameterType` in
   `packages/shared/src/workflowEvents.ts`
2. Implement the `case` in the `renderParam` switch inside
   `packages/console/src/components/workflow/WorkflowEventWizard.tsx` — it
   receives the parameter definition + the **live** config, and writes via
   `setParam(name, value)` (write-through `onConfigChange`)
3. If the control needs console context beyond the wizard props (tables,
   variables, modals), add a capability prop to `WorkflowEventWizardProps` and
   supply it from `WorkflowStudio.renderEventWizard`
4. Handle the value in the plugin's `execute(ctx)` reading `ctx.eventConfig`

## 5. BYOC Script Event

### How a script "registers"

1. Admin writes JavaScript in the Console **BYOC** page.
2. `POST /api/byoc/scripts` persists it to `core.record_scripts`
   (validation: syntax check, size limit, `isActive` flag).
3. Admin opens **Route Studio**, drags a **Script Event** into a stage and
   picks the script from a dropdown (loaded from `core.record_scripts`).
4. The DAG event config records the reference:

```json
{
  "type": "script",
  "label": "Calculate Risk Score",
  "config": {
    "scriptId": "scr_xyz",
    "timing": "stage_enter",
    "timeoutMs": 5000
  }
}
```

5. At runtime `ScriptEventPlugin.execute()` loads the script, runs it in a
   sandbox, and merges `ctx.variables` mutations back into the instance.

### Storage model

```prisma
model RecordScript {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  description String?
  scriptCode  String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, isActive])
  @@map("record_scripts")
  @@schema("core")
}
```

## 6. Script Context Variables

The sandbox receives one frozen context object:

```
ctx.record.id        // record id
ctx.record.values    // current field values  { status: "pending", amount: 5000 }
ctx.record.oldValues // previous values — only set on update
ctx.instance.id      // wf_instance id
ctx.stage.id         // current stage id
ctx.variables        // workflow variables (read/write via assignment)
ctx.session.userId   // acting user
ctx.session.teamId   // acting team
ctx.table.name       // physical table name
ctx.operation        // "create" | "update" | "delete"
ctx.timing           // "stage_enter" | "stage_exit"
```

Variables are referenced with `{{name}}` in UI fields (recipients, subject)
and as bare identifiers inside JSONata expressions.

## 7. Sandboxed SDK (the only API surface)

Scripts get a restricted `sails` SDK. Everything else is closed — no
`require`, `process`, `fetch`, `console`, filesystem.

```js
sails.log("message")                        // tenant-scoped log line
sails.query("table_name").where({...}).get() // read-only record query
sails.notify("template_key", { recipient, data }) // bell / email
sails.http.post(url, body)                  // outbound webhook (rate-limited)
sails.abort("reason")                       // fail the event (before-commit only)
```

All SDK calls are audited (`wf_action_log` + `data_audit_logs`) and
rate-limited per tenant.

## 8. Execution & Sandbox

Sandboxed V8 execution of tenant BYOC scripts. NOT PostgreSQL triggers, NOT
`eval` on host globals, NOT `vm2` (abandoned, CVEs).

- **v1**: Node `vm` module with a locked-down context — `ctx` + `sails` SDK
  only; `require`, `process`, `fetch`, `console`, `setTimeout` are absent.
  CPU timeout (default 5s) and a 64KB script size cap.
- **Hardening path**: swap the `ScriptSandbox` backend for `isolated-vm`
  (true V8 isolate, like Cloudflare Workers / Shopify Functions). The sandbox
  API surface is backend-agnostic — callers don't change.

```
WorkflowEngine.startInstance()
  → fires stage_enter events of the first stage
WorkflowEngine.advanceInstance()
  → for each event in stage order:
      → resolve plugin from WorkflowEventRegistry
      → ScriptEventPlugin:
          → load script from core.record_scripts (must be isActive)
          → sandbox run (CPU timeout 5s, size cap 64KB)
          → inject ctx + sails SDK
          → execute
          → apply ctx.variables mutations (persisted to wf_instance.vars)
  → ApprovalEventPlugin creates wf_task rows (router: user/team/position/role/field)
  → when all tasks decided → stage_exit events fire → instance completes
```

Two timings for events:

| Timing | Runs | Failure behavior |
|---|---|---|
| `stage_enter` (before) | when the instance enters a stage (startInstance / advance) | throws → instance marked `failed`, start is rejected |
| `stage_exit` (after) | when a stage's tasks are all decided | error is logged, workflow continues |

JSONata (`jsonata` dependency in `packages/core` and `packages/console`) powers
the Expression event, the Transform event, branch conditions, and the tabbed
configuration's field-mapping source paths. The shared evaluation helper lives in
`WorkflowHelpers.evaluateJsonata` (lazy-loaded once at module level) — used by
the engine and both JSONata plugins.

## 9. Security Invariants

- No script can execute outside the isolate; no host objects exposed beyond `ctx` + `sails`.
- Scripts are tenant-scoped; `tenantId` is enforced on every load.
- `scriptCode` is validated server-side before save (syntax + size).
- `isActive=false` scripts are never loaded (deactivate = soft delete).
- Golden rule: `core.record_scripts` is written via POST/PATCH API only,
  never from a GET handler.
- Running instances pin to a `WorkflowVersion` snapshot — a script edited
  after publish is NOT picked up by in-flight instances (see
  `WORKFLOW_VERSIONING.md`).
- **Notification Event**: bell + email delivery via tenant `wf_notification` and
  SMTP `EmailConnection` (see below). Recipients are resolved from user/team/
  position/role references + `{{variable}}` interpolation.

## 10. Notification Event Plug-In

The `notification` event type delivers bell (in-app) and email notifications.

### Architecture

- **Bell delivery** — inserts rows into the tenant-schema `wf_notification` table per resolved user (status = `delivered` → `read`). Polled by the console's Topbar bell badge.
- **Email delivery** — sends via the tenant's active `EmailConnection` (v1: SMTP with AES-encrypted credentials). Email delivery is audited in `wf_action_log`.
- **Customer data principle** — all notification data lives in tenant schemas (`wf_notification`). `EmailConnection` stores configuration only (SMTP host/port/creds — no customer communications).

### `EmailConnection` model (core schema)

| Provider | `smtp` (v1), `google` / `exchange_online` (future) |
|---|---|
| `smtp_host`/`smtp_port`/`smtp_secure` | SMTP transport (all providers) |
| `auth_type` | `basic` (SMTP) or `oauth2` (future) |
| `password` | AES-256-GCM encrypted (`ENCRYPTION_KEY` env) |
| `oauth_*` fields | Per-tenant OAuth2 credentials (future — Google / MS integration) |
| `from_name` / `from_email` | Sender envelope |

### `wf_notification` table (tenant schema)

```
id, instance_id, user_id, source ('workflow'|'chat'|...), subject, body,
status ('delivered'|'read'), created_at, read_at
```

### Recipient resolution

The `recipients` config field resolves at runtime:
- `user:<id>`, `team:<id>`, `position:<id>`, `role:<role>` → tenant users
- `email@domain.com` → literal email
- `{{variable}}` → values from ctx.variables (string/array/user ids/record rows)
- Deduped; bell only for users with a known `user_id`

### Template rendering

`{{variable}}` replaced with ctx.variables values; `{{record.<field>}}` with the triggering record's fields. Plain text for bell; HTML for email (tiptap editor support planned).

## 11. Related Concepts

- **Record Trigger Plug-In** (QueryLayer lifecycle hooks) decides *whether a
  workflow starts at all* on record save. Workflow Event Plug-Ins run *inside*
  a started instance. The `script` event type is orthogonal to — but may reuse
  the same sandbox — as record trigger scripts.
- **Language**: JavaScript only. No arbitrary bytecode; every expression
  (Expression event, Transform event, branch conditions) is JSONata — a
  declarative, non-executable format. There is no custom DSL.

## 12. Files

| File | Purpose | Status |
|---|---|---|
| `packages/shared/src/workflowEvents.ts` | Event-type configuration schema (`WORKFLOW_EVENT_CONFIGS`) + parameter types — single source of truth | Done |
| `packages/shared/src/workflowSchema.ts` | Collection workflow variable JSON-Schema generation + validation (`validateCollectionValue`) | Done |
| `packages/core/src/core/registry/WorkflowEventRegistry.ts` | Compile-time event type registry | Done |
| `packages/core/src/core/registry/WorkflowEventPlugin.ts` | Plugin + context contract (`parametersSchema`, `execute`) | Done |
| `packages/core/src/core/engine/WorkflowEventPlugins.ts` | Built-in plugins incl. Record (QueryLayer CRUD) + Script (BYOC) + **Notification (bell/email)** | Done |
| `packages/core/src/core/engine/WorkflowEngine.ts` | Instance start/advance, `fireStageEvents`, runtime table provisioning incl. `wf_notification` | Done |
| `packages/core/src/core/engine/WorkflowHelpers.ts` | Shared `evaluateJsonata`, `quoteIdent`, `genId`, `logWfAction`, `MAX_SCRIPT_BYTES` | Done |
| `packages/core/src/core/engine/notifications.ts` | Recipient resolution (`resolveRecipients`), template render, bell insert | Done |
| `packages/core/src/core/engine/ScriptSandbox.ts` | Sandbox wrapper (vm v1 / isolated-vm path) | Done |
| `packages/core/src/services/MailService.ts` | SMTP email transport via `EmailConnection` (nodemailer) | Done |
| `packages/core/src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt for SMTP credentials | Done |
| `packages/core/src/app/api/admin/email-connections/route.ts` | CRUD for `EmailConnection` (admin-gated) | Done |
| `packages/core/src/app/api/notifications/route.ts` | Bell notification fetch + mark-read (user-scoped) | Done |
| `packages/core/src/app/api/byoc/scripts/route.ts` | CRUD for `core.record_scripts` | Done |
| `packages/core/prisma/schema.prisma` | `RecordScript`, `EmailConnection` models | Done |
| `prisma/migrations/20260806_record_scripts/` | Migration — RecordScript | Done |
| `prisma/migrations/20260808_email_connections/` | Migration — EmailConnection | Done |
| `packages/console/src/components/workflow/WorkflowEventWizard.tsx` | Generic, schema-driven tabbed event configuration (all event types, Event tab + validation) | Done |
| `packages/console/src/pages/custom/WorkflowStudio.tsx` | Workflow Studio — canvas, properties, event configuration wiring | Done |
| `packages/console/src/pages/__mockups__/RouteBuilder.tsx` | Legacy Route Studio mockup (superseded by WorkflowStudio) | Mockup |
| `packages/console/src/pages/admin/AdminByocModules.tsx` | Script manager UI (authoring, validation) | Stub |
| `docs/WORKFLOW_VERSIONING.md` | Version pinning of published DAGs | — |

Record Trigger Plug-In (QueryLayer lifecycle hooks, deciding *whether* a
workflow starts on record save) is the remaining integration piece — the
`WorkflowEngine.startInstance` / `fireStageEvents` entry points are ready for
it.
