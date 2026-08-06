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
| `record` | Record Event | CRUD on a model; store result to a workflow variable |
| `notification` | Notification | Bell / Email delivery |
| `approval` | Task Approval | Assign approval task to a router (user / team / position / role / record field) |
| `expression` | Expression Event | JSONata compute (condition / assignment) |
| `transform` | Transform Event | JSONata mapping |
| `script` | Script Event | Execute a tenant BYOC script in a sandbox |

The `script` type is the BYOC extension point. It is a built-in event type;
each admin-authored script is a **configuration** of it.

> The RouteBuilder mockup already models these: `EVENT_DEFS` in
> `packages/console/src/pages/__mockups__/RouteBuilder.tsx` defines the first
> five; the `script` type is the planned sixth.

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
interface WorkflowEventPlugin {
  type: WorkflowEventType;              // 'record' | 'notification' | ... | 'script'
  label: string;
  icon: React.ReactNode;                // palette icon (console side)
  // Frontend: config form rendered in Route Studio properties panel
  renderConfigForm(config: EventConfig, onChange: (patch) => void): React.ReactNode;
  // Backend: executed by WorkflowEngine when the stage fires
  execute(ctx: WorkflowEventContext): Promise<WorkflowEventResult>;
}

interface WorkflowEventContext {
  instanceId: string;
  stageId: string;
  tableName: string;
  recordId: string;
  variables: Record<string, any>;       // workflow variables
  session: { userId: string; tenantId: string; teamId: string | null };
  timing: 'stage_enter' | 'stage_exit';
}

interface WorkflowEventResult {
  success: boolean;
  output?: Record<string, any>;         // merged back into ctx.variables
  error?: string;
}
```

Built-in plugins live in `packages/core/src/core/engine/WorkflowEventPlugins.ts`
and are registered in `WorkflowEventRegistry` at startup — mirroring
`FieldRegistry.ts`.

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

The `transform` (JSONata) plugin requires the `jsonata` dependency in
`packages/core` — already declared.

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

## 10. Related Concepts

- **Record Trigger Plug-In** (QueryLayer lifecycle hooks) decides *whether a
  workflow starts at all* on record save. Workflow Event Plug-Ins run *inside*
  a started instance. The `script` event type is orthogonal to — but may reuse
  the same sandbox — as record trigger scripts.
- **Language**: JavaScript only. No arbitrary bytecode; every expression
  (Expression event, Transform event, branch conditions) is JSONata — a
  declarative, non-executable format. There is no custom DSL.

## 11. Files

| File | Purpose | Status |
|---|---|---|
| `packages/core/src/core/registry/WorkflowEventRegistry.ts` | Compile-time event type registry | Done |
| `packages/core/src/core/registry/WorkflowEventPlugin.ts` | Plugin + context contract | Done |
| `packages/core/src/core/engine/WorkflowEventPlugins.ts` | Built-in plugins incl. `ScriptEventPlugin` (JSONata-based expression/transform) | Done |
| `packages/core/src/core/engine/ScriptSandbox.ts` | Sandbox wrapper (vm v1 / isolated-vm path) | Done |
| `packages/core/src/app/api/byoc/scripts/route.ts` | CRUD for `core.record_scripts` | Done |
| `packages/core/prisma/schema.prisma` | `RecordScript` model | Done |
| `prisma/migrations/20260806_record_scripts/` | Migration | Done |
| `packages/console/src/pages/__mockups__/RouteBuilder.tsx` | Route Studio palette + stage event config | Mockup |
| `packages/console/src/pages/admin/AdminByocModules.tsx` | Script manager UI (authoring, validation) | Stub |
| `docs/WORKFLOW_VERSIONING.md` | Version pinning of published DAGs | — |

Record Trigger Plug-In (QueryLayer lifecycle hooks, deciding *whether* a
workflow starts on record save) is the remaining integration piece — the
`WorkflowEngine.startInstance` / `fireStageEvents` entry points are ready for
it.
