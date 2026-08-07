/**
 * WorkflowEventPlugin — the Workflow Event Plug-In contract (Option A).
 *
 * Event TYPES are compile-time registrations (like FieldTypePlugin); the
 * events that appear inside a stage are CONFIGURATIONS of those types held in
 * the workflow DAG. The 'script' type is the BYOC extension point — its
 * configuration references a row in core.record_scripts.
 *
 * `parametersSchema` mirrors the FieldTypePlugin pattern: each event type
 * declares its configuration as ordered wizard steps, and the console renders
 * a standard wizard from it — adding an event type needs no per-type UI code.
 */
import type { WorkflowEventConfigStep } from '@sails/shared';

export type WorkflowEventType =
  | 'record'
  | 'notification'
  | 'approval'
  | 'expression'
  | 'transform'
  | 'script';

export interface WorkflowEventContext {
  tenantId: string;
  instanceId: string;
  stageId: string | null;
  /** Physical tenant table name (null when the definition has no model). */
  tableName: string | null;
  recordId: string | null;
  /** The triggering record (populated by the Record Trigger hook when started from a record event). */
  record: {
    id: string | null;
    values: Record<string, any>;
    oldValues?: Record<string, any>;
  } | null;
  /** create | update | delete — null when the workflow was started manually. */
  operation: string | null;
  /** Mutable workflow variables — output of prior events is merged here. */
  variables: Record<string, any>;
  /** The DAG's workflow variable declarations (definitions, not values). */
  variableDefs?: any[];
  session: { userId: string; teamId: string | null };
  timing: 'stage_enter' | 'stage_exit';
  eventConfig: Record<string, any>;
}

export interface WorkflowEventResult {
  success: boolean;
  /** Merged back into ctx.variables by the engine. */
  output?: Record<string, any>;
  error?: string;
}

export interface WorkflowEventPlugin {
  type: WorkflowEventType;
  label: string;
  description: string;
  /** Ordered wizard steps rendering this event type's configuration (shared schema). */
  parametersSchema: WorkflowEventConfigStep[];
  execute(ctx: WorkflowEventContext): Promise<WorkflowEventResult>;
}
