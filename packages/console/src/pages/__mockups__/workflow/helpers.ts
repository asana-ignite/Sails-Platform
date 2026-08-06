import jsonata from 'jsonata';
import type {
  BranchCondition, RouteStage, RoutingProcess, WorkflowEvent, WorkflowEventType, WorkflowVariable,
} from './types';

let counter = 0;
export function genId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function newEvent(type: WorkflowEventType): WorkflowEvent {
  const id = genId('ev');
  switch (type) {
    case 'record':
      return { id, type, label: 'Record Event', config: { model: 'Contracts', operation: 'update', storeToVariable: '' } };
    case 'notification':
      return { id, type, label: 'Notification', config: { channel: 'bell', recipients: '', subject: '', message: '' } };
    case 'approval':
      return { id, type, label: 'Task Approval', config: { routerType: 'role', routerValue: '', routerLabel: 'Approver', canApprove: true, canReject: true, timeoutHours: null } };
    case 'expression':
      return { id, type, label: 'Expression', config: { expression: '', assignToVariable: '' } };
    case 'transform':
      return { id, type, label: 'Transform', config: { expression: '', assignToVariable: '' } };
    case 'script':
      return { id, type, label: 'Script', config: { scriptId: '', scriptName: '', timeoutMs: 5000 } };
  }
}

export function newStage(name: string, x: number, y: number): RouteStage {
  return {
    id: genId('st'),
    name,
    x,
    y,
    routerType: 'team',
    routerValue: '',
    routerLabel: '',
    canApprove: true,
    canReject: true,
    canComment: true,
    canReassign: false,
    timeoutHours: null,
    entryCondition: '',
    events: [],
    branches: [],
  };
}

export function newBranch(): BranchCondition {
  return { id: genId('br'), label: 'New Branch', expression: '', targetType: 'completed', targetStageId: undefined };
}

export function newVariable(): WorkflowVariable {
  return { id: genId('var'), name: '', fieldType: 'short_text', defaultValue: undefined };
}

export function buildSample(): RoutingProcess {
  const s1 = newStage('Contract Submission', 200, 40);
  const s2 = newStage('Senior Approval', 120, 280);
  const s3 = newStage('Junior Approval', 520, 280);
  const s4 = newStage('Final Sign-off', 320, 520);

  s1.events = [
    { id: genId('ev'), type: 'record', label: 'Record Event', config: { model: 'Contracts', operation: 'create', storeToVariable: '' } },
    { id: genId('ev'), type: 'notification', label: 'Notification', config: { channel: 'bell', recipients: '{{requestor}}', subject: 'Contract submitted', message: 'A new contract awaits review.' } },
  ];
  s2.events = [
    { id: genId('ev'), type: 'approval', label: 'Task Approval', config: { routerType: 'role', routerValue: 'director', routerLabel: 'Director', canApprove: true, canReject: true, timeoutHours: 48 } },
    { id: genId('ev'), type: 'notification', label: 'Notification', config: { channel: 'email', recipients: '{{requestor}}', subject: 'Approved by Director', message: '' } },
  ];
  s3.events = [
    { id: genId('ev'), type: 'approval', label: 'Task Approval', config: { routerType: 'role', routerValue: 'manager', routerLabel: 'Manager', canApprove: true, canReject: true, timeoutHours: 24 } },
  ];
  s4.events = [
    { id: genId('ev'), type: 'approval', label: 'Task Approval', config: { routerType: 'position', routerValue: 'ceo', routerLabel: 'CEO', canApprove: true, canReject: true, timeoutHours: null } },
    { id: genId('ev'), type: 'expression', label: 'Expression', config: { expression: "status = 'approved'", assignToVariable: 'status' } },
    { id: genId('ev'), type: 'transform', label: 'Transform', config: { expression: "{ 'summary': $uppercase(department) & ' contract of ' & $string(amount), 'is_high': amount > 50000 }", assignToVariable: '' } },
  ];

  s1.branches = [
    { id: genId('br'), label: 'High value', expression: 'amount > 50000', targetType: 'stage', targetStageId: s2.id },
    { id: genId('br'), label: 'Else', expression: '', targetType: 'stage', targetStageId: s3.id },
  ];
  s2.branches = [{ id: genId('br'), label: 'To sign-off', expression: 'approved == true', targetType: 'stage', targetStageId: s4.id }];
  s3.branches = [{ id: genId('br'), label: 'To sign-off', expression: 'approved == true', targetType: 'stage', targetStageId: s4.id }];
  s4.branches = [{ id: genId('br'), label: 'Complete', expression: '', targetType: 'completed' }];

  return {
    name: 'Contract Review',
    description: 'Route contracts through Legal → Finance sign-off',
    tableId: 't_contracts',
    variables: [
      { id: genId('var'), name: 'amount', fieldType: 'currency', defaultValue: 0 },
      { id: genId('var'), name: 'requestor', fieldType: 'user', defaultValue: undefined },
      { id: genId('var'), name: 'department', fieldType: 'select', defaultValue: 'Sales' },
      { id: genId('var'), name: 'status', fieldType: 'short_text', defaultValue: 'draft' },
    ],
    stages: [s1, s2, s3, s4],
  };
}

/** Cheap JSONata syntax check — returns true when the expression compiles. */
export function isValidJsonata(expression: string): boolean {
  if (!expression || !expression.trim()) return true;
  try {
    jsonata(expression);
    return true;
  } catch {
    return false;
  }
}

/** Invalid branches (bad JSONata) across the process + whether any stage has no branch (implicit fallback). */
export function analyzeExpressions(process: RoutingProcess): { invalidBranches: BranchCondition[]; hasFallback: boolean } {
  const invalidBranches = process.stages.flatMap((s) =>
    s.branches.filter((br) => br.expression && !isValidJsonata(br.expression))
  );
  const hasFallback = process.stages.some((s) => s.branches.length === 0);
  return { invalidBranches, hasFallback };
}

/** Sample values for the expression editor's Test runner, built from the workflow variables. */
export function sampleValuesForVariables(variables: WorkflowVariable[]): Record<string, any> {
  return Object.fromEntries(
    variables
      .filter((v) => v.name)
      .map((v) => [
        v.name,
        v.fieldType === 'number' || v.fieldType === 'currency' || v.fieldType === 'decimal'
          ? (v.defaultValue ?? 0)
          : (v.defaultValue ?? (v.fieldType === 'boolean' ? false : 'sample value')),
      ]),
  );
}
