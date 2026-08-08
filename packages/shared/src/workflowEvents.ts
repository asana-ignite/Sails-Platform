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
  | 'transform'
  | 'script';

export type WorkflowEventConfigParameterType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'select'
  | 'model_select' | 'operation_select' | 'filter_builder'
  | 'variable_auto_create' | 'field_mapping' | 'target_record'
  | 'variable_select' | 'expression_editor' | 'html_editor' | 'attachment_list';

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

export const WORKFLOW_EVENT_CONFIGS: Record<WorkflowEventType, WorkflowEventConfigStep[]> = {
  record: [
    {
      label: 'Action',
      parameters: [
        { name: 'model', label: 'Target Model', type: 'model_select', required: true, description: 'The model the event operates on.' },
        { name: 'operation', label: 'Operation', type: 'operation_select', defaultValue: 'read' },
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
        { name: 'storeToVariable', label: 'Result Variable', type: 'variable_auto_create', description: 'Auto-creates a record variable for read/write results (collection for list).' },
      ],
    },
  ],

  notification: [
    {
      label: 'Notification',
      parameters: [
        {
          name: 'channel', label: 'Channel', type: 'select', defaultValue: 'bell',
          options: [
            { label: 'Bell (in-app)', value: 'bell' },
            { label: 'Email', value: 'email' },
            { label: 'Both', value: 'both' },
          ],
        },
        { name: 'recipients', label: 'Recipients', type: 'text', placeholder: 'user@x or {{variable}}' },
        { name: 'subject', label: 'Subject', type: 'text' },
        { name: 'message', label: 'Message', type: 'html_editor' },
      ],
    },
    {
      label: 'Attachments',
      parameters: [
        { name: 'attachments', label: 'Email Attachments', type: 'attachment_list' },
      ],
    },
  ],

  approval: [
    {
      label: 'Task Approval',
      parameters: [
        {
          name: 'routerType', label: 'Router Type', type: 'select', defaultValue: 'role',
          options: [
            { label: 'Specific User', value: 'user' },
            { label: 'Team', value: 'team' },
            { label: 'Position', value: 'position' },
            { label: 'Role', value: 'role' },
            { label: 'Record Field', value: 'field' },
          ],
        },
        { name: 'routerValue', label: 'Router Value', type: 'text' },
        { name: 'routerLabel', label: 'Display Label', type: 'text', defaultValue: 'Approver' },
        { name: 'canApprove', label: 'Allow Approve', type: 'boolean', defaultValue: true },
        { name: 'canReject', label: 'Allow Reject', type: 'boolean', defaultValue: true },
        { name: 'timeoutHours', label: 'Timeout (hours)', type: 'number', placeholder: 'No timeout' },
      ],
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

  transform: [
    {
      label: 'Transform',
      parameters: [
        { name: 'expression', label: 'JSONata Transform', type: 'expression_editor', required: true },
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
