# Form Event — Detail View Action Button Event Chains

## Session design decisions (2025-08-12)

### Problem
Add Action Buttons to the Detail View in Layout Studio. Control what happens after click — beyond simple CRUD — by attaching a configurable sequence of events to each button.

### Key architectural decision: reuse `workflowEventRegistry` plugins

The workflow engine has a plugin registry (`packages/core/src/core/plugins/init.ts:12-17`) with these event types already registered:

| Plugin | Type | What it does |
|--------|------|-------------|
| `plugin-record-event` | `record` | CRUD via `/api/dynamic` (create/update/delete with field mapping) |
| `plugin-expression` | `expression` | JSONata expression evaluation |
| `plugin-script` | `script` | BYOC JavaScript function |
| `plugin-notification` | `notification` | Email/Slack with template + record field injection |

Each has `type`, `config`, and `execute(ctx)` — identical interface needed by form events. Difference is context: workflow passes instance vars + DAG state; form event passes current record + form data directly.

**`plugin-approval` is excluded** from form events — it requires task lifecycle/pause/resume which doesn't fit an inline chain.

### Execution model: inline, sequential

```
Button click → FOR each event:
  ├─ Evaluate guard condition (optional JSONata, skip if false)
  ├─ lookup: workflowEventRegistry.getPlugin(event.type)
  ├─ build ctx: record, variables (accumulated), session, tenantId
  ├─ plugin.execute(ctx) → { success, result }
  ├─ store result → ctx.variables["key"]
  ├─ if fail: STOP chain, show error (events before this are NOT rolled back)
  └─ if ok: continue
→ refetch record, show success toast
```

- **Inline** (not queued): button shows spinner + "Running Step N of M"
- **Independent operations** per event: each event commits immediately (event 3 can see event 2's result)
- **No rollback**: earlier events stay committed on failure
- **Per-event timeout** to prevent hangs (config-driven)
- **Three states**: idle → running → completed | failed

### UI: list builder, NOT canvas (for v1)

V1 ships with an accordion/list builder inside the Layout Studio Actions card — ordered items, drag to reorder, inline config panels per event type, mirroring the existing WorkflowEventWizard per-type widgets.

**Canvas deferred to v2.** The form event model is inherently sequential (ordered list, guards only skip — no branching). A canvas (DAG nodes, edge routing, forks/joins) only becomes necessary when branching conditions create multiple paths. At that point reuse WorkflowStudio's existing canvas.

> **Sweet spot note:** Start with the list. Add an "Open in Canvas" button later that converts the linear sequence into a canvas view if the user adds branch conditions. V1 ships fast with the list; v2 is a pure UX upgrade with no backend changes.

### Config stored on DetailAction in layout JSON

```
LayoutConfig.detailActions[] extended:
{
  id, actionKey, label, variant, visible,
  events?: FormEvent[]    // NEW
}

FormEvent:
{
  id, type: 'record' | 'expression' | 'script' | 'notification' | 'validate',
  label,                   // user-friendly display name
  condition?,              // JSONata guard expression
  config: { /* per-type */ },
  storeAs?,                // store result into variables.$key for downstream events
  timeout?: number,        // ms, default 10_000
}
```

### New backend route

`POST /api/dynamic/:table/form-event` — same Security Pipeline / RLS as all dynamic API calls. Receives `{ recordId, events: FormEvent[] }`, executes sequentially via the event registry, returns `{ success, results, finalRecord }`.

### ActionRegistry vs form events: coexistence

- **Plain actions** (delete, clone, set-status): `actionKey` maps to a built-in handler in DynamicDetailPage — no events, no registry lookup. Simple switch statement.
- **Form event actions**: `actionKey: 'workflow'` (or `'form-event'`) + `events[]` array — button handler POSTs the event chain to the new route.
- Both coexist: the config decides per-button whether it's a simple action or an event chain.

### Open items for v1 implementation

- [ ] Detail view "Events" tab in Layout Studio Actions card
- [ ] `POST /api/dynamic/:table/form-event` route
- [ ] `FormEvent` type in shared/index.ts
- [ ] `DetailAction` extension with `events?: FormEvent[]`
- [ ] DynamicDetailPage: button click → POST → handle response
- [ ] Reuse WorkflowEventWizard per-type config panels
- [ ] Per-event guard/protection (condition expression, timeout)
