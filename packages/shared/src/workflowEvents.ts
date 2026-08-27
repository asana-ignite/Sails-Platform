/**
 * Workflow Event configuration schema — the metadata contract that drives the
 * platform-standard event configuration wizard (shared by core plugins and the
 * console wizard renderer, mirroring the FieldTypeRegistry pattern).
 *
 * Each event TYPE declares its configuration as ordered wizard STEPS, each
 * step holding PARAMETERS. The console renders these generically; adding a
 * new event type (or a new parameter) requires no per-type UI code.
 */

export type WorkflowEventType =
  | 'record'
  | 'notification'
  | 'approval'
  | 'expression'
  | 'script'
  | 'notification_message';

export type WorkflowEventConfigParameterType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'select'
  | 'model_select' | 'operation_select' | 'filter_builder'
  | 'variable_auto_create' | 'field_mapping' | 'output_mapping' | 'target_record'
  | 'variable_select' | 'expression_editor' | 'html_editor' | 'attachment_list'
  | 'assignee' | 'workflow_actions';

export interface WorkflowEventConfigParameter {
  /** Key inside the event's config JSON (e.g. "model", "storeToVariable"). */
  name: string;
  label: string;
  type: WorkflowEventConfigParameterType;
  defaultValue?: any;
  description?: string;
  placeholder?: string;
  required?: boolean;
  /** Options for `select` parameters. */
  options?: { label: string; value: string }[];
}

export interface WorkflowEventConfigStep {
  label: string;
  parameters: WorkflowEventConfigParameter[];
}

const OPERATIONS = [
  { label: 'Create (Insert)', value: 'create' },
  { label: 'Update', value: 'update' },
  { label: 'Upsert (insert or update)', value: 'upsert' },
  { label: 'Delete', value: 'delete' },
  { label: 'Read (one record)', value: 'read' },
  { label: 'List (many records)', value: 'list' },
];

const TARGET_RECORD_OPTIONS = [
  { label: 'Triggering Record', value: 'trigger' },
  { label: 'By Variable', value: 'variable' },
  { label: 'By Literal ID', value: 'literal' },
];

// ─── Shared Notification parameters ───────────────────────────
// Single source of truth for notification fields — used by BOTH the
// Notification event and the Task Approval "Notification" step (no copy).
const NOTIFICATION_CHANNEL_PARAM: WorkflowEventConfigParameter = {
  name: 'channel', label: 'Delivery Channel', type: 'select', defaultValue: 'bell',
  options: [
    { label: 'Email', value: 'email' },
    { label: 'Bell (in-app)', value: 'bell' },
  ],
};

const NOTIFICATION_BODY_PARAMETERS: WorkflowEventConfigParameter[] = [
  { name: 'emailRecipients', label: 'Email Recipients', type: 'text', placeholder: 'name@example.com, role:admins or {{variable}}',
    description: 'Emails or system tokens (user:, role:, team:, position:, {{variable}}) — system tokens resolve to their user email.' },
  { name: 'emailCc', label: 'CC', type: 'text', placeholder: 'cc@example.com or {{variable}}',
    description: 'Carbon copy recipients — emails or system tokens (resolved to emails).' },
  { name: 'emailBcc', label: 'BCC', type: 'text', placeholder: 'bcc@example.com or {{variable}}',
    description: 'Blind carbon copy recipients — emails or system tokens (resolved to emails).' },
  { name: 'bellRecipients', label: 'Bell Recipients', type: 'text', placeholder: 'user:ID, role:name or {{variable}}' },
  { name: 'subject', label: 'Subject', type: 'text' },
  { name: 'message', label: 'Message', type: 'html_editor' },
];

const NOTIFICATION_ATTACHMENTS_PARAM: WorkflowEventConfigParameter = {
  name: 'attachments', label: 'Email Attachments', type: 'attachment_list',
};

/**
 * Approval Notification parameters — the Notification event's fields WITHOUT
 * the Delivery Channel selector and WITHOUT recipient fields (To / CC / BCC):
 * delivery targets the resolved assignees, gated by "Send to Email" /
 * "Send to Bell" checkboxes (the approval's Simple Action Reply model).
 */
const APPROVAL_NOTIFICATION_PARAMETERS: WorkflowEventConfigParameter[] = [
  { name: 'notifyEmail', label: 'Delivery', type: 'boolean', defaultValue: true, description: 'Send the notification by email to the assignees.' },
  { name: 'notifyBell', label: 'Send to Bell', type: 'boolean', defaultValue: true, description: 'Send the notification as a bell (in-app) alert to the assignees.' },
  { name: 'subject', label: 'Subject', type: 'text' },
  { name: 'message', label: 'Message', type: 'html_editor' },
  NOTIFICATION_ATTACHMENTS_PARAM,
];

/** One decision action on an approval task. `value` is the routable slug. */
export interface WorkflowAction {
  label: string;
  value: string;
  color?: string;
  icon?: string;
}

/** Slugify an action label into its routing value (mirrors the Select field). */
export function slugActionLabel(label: string): string {
  return (label || '').trim().toLowerCase().replace(/\s+/g, '_');
}

const ACTION_STYLE_KEYWORDS: { value: RegExp; color: string; icon: string }[] = [
  { value: /approve|accepted|approved|confirm|yes|proceed|sign/i, color: '#10b981', icon: 'CheckCircle2' },
  { value: /reject|declin|deny|denied|no\b|disapprove/i, color: '#ef4444', icon: 'XCircle' },
  { value: /request_changes|changes|amend|rework|edit|revise/i, color: '#f59e0b', icon: 'RefreshCw' },
  { value: /more_info|need_info|clarif|info|question/i, color: '#3b82f6', icon: 'Info' },
  { value: /send_back|sent_back|reassign|assign_back|return/i, color: '#8b5cf6', icon: 'CornerUpLeft' },
];

/** Default color/icon for an action value (only stored once the user overrides). */
export function defaultActionStyle(value: string): { color: string; icon: string } {
  for (const k of ACTION_STYLE_KEYWORDS) {
    if (k.value.test(value || '')) return { color: k.color, icon: k.icon };
  }
  return { color: '#64748b', icon: 'Circle' };
}

/** Parse "one action per line" source into WorkflowAction[] (Select-field style). */
export function parseWorkflowActions(source: string): WorkflowAction[] {
  return (source || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ label, value: slugActionLabel(label) }));
}

export const WORKFLOW_EVENT_CONFIGS: Record<WorkflowEventType, WorkflowEventConfigStep[]> = {
  record: [
    {
      label: 'Action',
      parameters: [
        { name: 'model', label: 'Target Model', type: 'model_select', required: true, description: 'The model the event operates on.' },
        { name: 'operation', label: 'Action', type: 'operation_select', required: true, description: 'Which operation the event performs on the target model.' },
        { name: 'filterGroups', label: 'Record Filter', type: 'filter_builder', description: 'QueryStudio filter for read / list / update / delete.' },
        { name: 'targetType', label: 'Target Record (ID)', type: 'select', defaultValue: 'trigger', options: TARGET_RECORD_OPTIONS },
        { name: 'targetValue', label: 'Target Value', type: 'variable_select', placeholder: 'Variable name or record ID', description: 'Used when Target Record is "By Variable" (dropdown) or "By Literal ID" (text). For upsert it selects the record to update when the id already exists.' },
      ],
    },
    {
      label: 'Input',
      parameters: [
        { name: 'fieldMapping', label: 'Field Mapping', type: 'field_mapping', description: 'Map inputs (Workflow Context, variables, collections) onto model columns for create/update/upsert (system columns excluded).' },
      ],
    },
    {
      label: 'Output',
      parameters: [
        { name: 'storeToVariable', label: 'Result Variable', type: 'variable_auto_create', description: 'The output variable (record for read/write results, collection for list) — create it with the Create button or pick an existing one. Required before Complete.' },
        { name: 'outputMapping', label: 'Output Mapping', type: 'output_mapping', description: 'Map single-record result fields onto workflow variables (swapped sides vs Input).' },
      ],
    },
  ],

  notification: [
    {
      label: 'Notification',
      parameters: [NOTIFICATION_CHANNEL_PARAM, ...NOTIFICATION_BODY_PARAMETERS],
    },
    {
      label: 'Attachments',
      parameters: [NOTIFICATION_ATTACHMENTS_PARAM],
    },
  ],

  approval: [
    {
      label: 'Assignee',
      parameters: [
        {
          name: 'routerType', label: 'Assign To', type: 'assignee', defaultValue: 'team',
        },
      ],
    },
    {
      label: 'Workflow Action',
      parameters: [
        {
          name: 'actions', label: 'Actions', type: 'workflow_actions', defaultValue: [],
          description: 'The available decisions on this task (e.g. Approve, Reject, Request Changes). Each action becomes a routable outcome for branch conditions. Legacy canApprove / canReject flags seed the default list.',
        },
        { name: 'timeoutHours', label: 'Timeout (hours)', type: 'number', placeholder: 'No timeout' },
      ],
    },
    {
      label: 'Notification',
      parameters: APPROVAL_NOTIFICATION_PARAMETERS,
    },
  ],

  expression: [
    {
      label: 'Expression',
      parameters: [
        { name: 'expression', label: 'JSONata Expression', type: 'expression_editor', required: true },
        { name: 'assignToVariable', label: 'Assign result to', type: 'text', placeholder: 'variable name' },
      ],
    },
  ],

  script: [
    {
      label: 'Script',
      parameters: [
        {
          name: 'scriptId', label: 'BYOC Script', type: 'select', required: true,
          options: [
            { label: '— select —', value: '' },
            { label: 'Calculate Risk Score', value: 'scr_risk_score' },
            { label: 'Send to ERP', value: 'scr_erp_sync' },
          ],
        },
        { name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000, placeholder: '5000' },
      ],
    },
  ],

  notification_message: [
    {
      label: 'Message',
      parameters: [
        {
          name: 'mode', label: 'Mode', type: 'select', defaultValue: 'confirm',
          options: [
            { label: 'Confirmation (Confirm / Cancel)', value: 'confirm' },
            { label: 'Notification (OK)', value: 'notification' },
          ],
        },
        {
          name: 'notificationType', label: 'Notification Type', type: 'select', defaultValue: 'information',
          options: [
            { label: 'Information', value: 'information' },
            { label: 'Success', value: 'success' },
            { label: 'Warning', value: 'warning' },
            { label: 'Caution', value: 'caution' },
            { label: 'Error', value: 'error' },
          ],
        },
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'message', label: 'Message', type: 'textarea', description: 'Supports {{record.field}} / {{variables.name}} tokens.' },
        { name: 'confirmLabel', label: 'Confirm Button Label', type: 'text', defaultValue: 'Confirm' },
        { name: 'cancelLabel', label: 'Cancel Button Label', type: 'text', defaultValue: 'Cancel' },
        { name: 'okLabel', label: 'OK Button Label', type: 'text', defaultValue: 'OK' },
      ],
    },
  ],
};

export const WORKFLOW_OPERATIONS = OPERATIONS;

/** One field-mapping row: which input feeds a model column. */
export interface WorkflowFieldMappingEntry {
  /** 'variable' → ctx.variables[sourceVar] (optionally [itemIndex].sourceField for record/collection values); 'record' → ctx.record.values[sourceField]; 'record_old' → ctx.record.oldValues[sourceField]; 'wf' → workflow context (requestor.* / request_date). */
  source?: 'variable' | 'record' | 'record_old' | 'wf';
  sourceVar?: string;
  sourceField?: string;
  /** Item index into a collection variable (default 0 = first item). */
  itemIndex?: number;
  targetCol: string;
}

// ─── Workflow Tasks & Approvals Contracts ──────────────────────

export interface WorkflowTaskAction {
  label: string;
  value: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export interface WorkflowTaskItem {
  id: string;
  instance_id: string;
  step_id: string;
  status: 'pending' | 'decided' | 'expired' | 'canceled' | string;
  assignee_type: string;
  assignee_id: string;
  assignee_users: string[];
  decisions?: Array<{ action: string; comment?: string; userId: string; timestamp: string }> | null;
  actions?: WorkflowTaskAction[];
  due_at: string | null;
  decided_by?: string | null;
  decision?: string | null;
  decided_at?: string | null;
  created_at: string;
  updated_at?: string;
  def_id?: string;
  instance_state?: string;
  def_name?: string;
  stage_name?: string;
  workflow_name?: string;
  table_name?: string;
  record_id?: string;
}

export interface WorkflowTaskDetail {
  task: WorkflowTaskItem;
  instance: {
    id: string;
    def_id?: string;
    defName?: string | null;
    def_name?: string | null;
    state?: string;
    status?: string;
    recordId?: string | null;
    record_id?: string | null;
    tableId?: string | null;
    tableName?: string | null;
    table_name?: string | null;
    createdAt?: string;
    created_at?: string;
    createdBy?: string | null;
    created_by?: string | null;
    trigger?: string | null;
    vars?: Record<string, any>;
  };
  stage?: {
    id: string;
    label?: string | null;
    name?: string | null;
    description?: string | null;
    type?: string;
  } | null;
  approvalEvent?: {
    message?: string;
    subject?: string;
    actions?: WorkflowTaskAction[];
    canApprove?: boolean;
    canReject?: boolean;
    attachments?: Array<{ id: string; name: string; url?: string; size?: number }>;
    [key: string]: any;
  } | null;
  timeline?: Array<{
    id: string;
    stepId?: string | null;
    action: string;
    actorId?: string | null;
    actorName?: string | null;
    detail?: any;
    createdAt: string;
  }>;
  users?: Record<string, { id: string; name: string | null; email: string | null; avatarUrl?: string }>;
  variableDefs?: any[];
}

export interface WorkflowDecisionPayload {
  action: string;
  comment?: string;
}


