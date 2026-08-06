// ─── Routing Process Builder — shared types ────────────────────

export type RouterType = 'user' | 'team' | 'position' | 'role' | 'field';
export type WorkflowEventType = 'record' | 'notification' | 'approval' | 'expression' | 'transform' | 'script';
export type LayoutMode = 'chain' | 'canvas';
export type Port = 'top' | 'right' | 'bottom' | 'left';

export interface Pt {
  x: number;
  y: number;
}

export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  label: string;
  config: Record<string, any>;
}

export interface WorkflowVariable {
  id: string;
  name: string;
  fieldType: string;
  defaultValue?: any;
}

export interface BranchCondition {
  id: string;
  label: string;
  expression: string;
  targetType: 'stage' | 'completed';
  targetStageId?: string;
  fromPort?: Port;
  toPort?: Port;
}

export interface RouteStage {
  id: string;
  name: string;
  x: number;
  y: number;
  routerType: RouterType;
  routerValue: string;
  routerLabel: string;
  canApprove: boolean;
  canReject: boolean;
  canComment: boolean;
  canReassign: boolean;
  timeoutHours: number | null;
  entryCondition: string;
  events: WorkflowEvent[];
  branches: BranchCondition[];
}

export interface RoutingProcess {
  name: string;
  description: string;
  tableId: string;
  variables: WorkflowVariable[];
  stages: RouteStage[];
}

/** A rendered edge between two nodes (derived from stages + branches). */
export interface WorkflowEdge {
  id: string;
  a: Pt;
  b: Pt;
  label: string;
  kind: 'branch' | 'implicit';
  fromPort: Port;
  toPort: Port;
  branchId?: string;
  sourceStageId?: string;
  isEndTarget: boolean;
}
