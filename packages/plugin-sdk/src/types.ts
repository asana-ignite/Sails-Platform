import type { WorkflowEventConfigStep } from '@sails/shared';

export type { WorkflowEventType, WorkflowEventConfigStep, WorkflowEventConfigParameter, WorkflowEventConfigParameterType } from '@sails/shared';

export interface WorkflowEventContext {
  tenantId: string;
  instanceId: string;
  stageId: string | null;
  /** Physical tenant table name (null when the definition has no model). */
  tableName: string | null;
  recordId: string | null;
  /** The triggering record (populated by the Record Trigger hook). */
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
  type: string;
  label: string;
  description: string;
  /** Ordered wizard steps for this event type's configuration (shared schema). */
  parametersSchema: WorkflowEventConfigStep[];
  execute(ctx: WorkflowEventContext): Promise<WorkflowEventResult>;
}

/**
 * Infrastructure core injects into third-party plugins at load time.
 * First-party (built-in) plugins access core internals directly and do not
 * use this — they import QueryLayer / helpers via module imports.
 */
export interface PluginSDK {
  registry: {
    register(plugin: WorkflowEventPlugin): void;
  };
  query: {
    insertRecord: (tableName: string, tenantId: string, data: Record<string, any>, session: { userId: string; teamId: string | null }) => Promise<{ id: string }>;
    updateRecord: (tableName: string, tenantId: string, id: string, data: Record<string, any>, session: { userId: string; teamId: string | null }) => Promise<void>;
    deleteRecord: (tableName: string, tenantId: string, id: string, session: { userId: string; teamId: string | null }) => Promise<void>;
    upsertRecord: (tableName: string, tenantId: string, conflictKey: string, data: Record<string, any>, session: { userId: string; teamId: string | null }) => Promise<{ id: string }>;
    listRecords: (tableName: string, tenantId: string, filters: any, session: { userId: string; teamId: string | null }) => Promise<any[]>;
  };
  helpers: {
    evaluateJsonata: (expr: string, bindings: Record<string, any>) => any;
    resolveTenantSchema: (tenantId: string) => Promise<string>;
    quoteIdent: (name: string) => string;
    genId: (prefix: string) => string;
    logWfAction: (tenantId: string, instanceId: string, action: string, detail: any) => Promise<void>;
    preprocessFilterGroups: (filters: any, ctx: any) => any;
  };
  /** PrismaClient instance (type-erased — cast to PrismaClient in plugin code). */
  db: any;
  /** pg Pool instance. */
  pool: any;
}
