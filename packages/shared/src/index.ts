/**
 * SAILS Shared Types — API Contract
 * 
 * This file defines all TypeScript interfaces used between
 * SAILS Core (Backend) and SAILS Console (Frontend).
 * 
 * Both projects should reference these types to ensure
 * type-safe communication across the API boundary.
 * 
 * Source of truth: sails-core/shared/types.ts
 */

export { FIELD_TYPE_REGISTRY, STRUCTURED_TYPE_SUBFIELDS, WORKFLOW_SCALAR_TYPES } from './fieldTypes';
export { COUNTRY_OPTIONS, PHONE_COUNTRY_OPTIONS, phoneFlag } from './countries';
export type { CountryOption, PhoneCountryOption } from './countries';
export { SYSTEM_PERMISSION_REGISTRY, getAllCapabilities } from './permissions';
export type { PermissionDefinition, SystemCapability } from './permissions';
export { PACKAGE_MANIFESTS, getAllPackageCapabilityDefinitions } from './packages';
export type { PackageManifest } from './packages';
export {
  validateFieldValue,
  validateRecord,
  isEmptyValue,
  sanitizeWritePayload,
  PRESET_REGEX_MAP,
} from './validation';
export type { ValidationIssue, ValidatableField } from './validation';
export {
  resolveDecimalPlaces,
  resolveThousandSeparator,
  formatDecimalValue,
  formatEditableValue,
  normalizeEditableValue,
  addThousandSeparators,
  clampDecimalInput,
  DEFAULT_DECIMAL_PLACES,
} from './numbers';
export { logicalTypeToJsonSchema, collectionValueSchema, validateCollectionValue, validateRecordValue } from './workflowSchema';
export type { CollectionColumn, CollectionVarShape } from './workflowSchema';
export { EXPRESSION_FUNCTIONS, EXPRESSION_FUNCTION_DOCS, registerExpressionFunctions } from './expressionFunctions';
export type { ExpressionFunction, ExpressionFunctionDoc } from './expressionFunctions';
export { coerceExpressionResult, expressionResultType } from './expressionEvaluation';
export type { ExpressionResultType } from './expressionEvaluation';
import type { ExpressionResultType } from './expressionEvaluation';
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isLocalized,
  localize,
  setLocalizedText,
  localizedTextFor,
  hasTranslations,
} from './localization';
export type { LocalizedText } from './localization';

export {
  WORKFLOW_EVENT_CONFIGS,
  WORKFLOW_OPERATIONS,
  slugActionLabel,
  defaultActionStyle,
  parseWorkflowActions,
} from './workflowEvents';
export type {
  WorkflowEventType,
  WorkflowEventConfigParameter,
  WorkflowEventConfigParameterType,
  WorkflowEventConfigStep,
  WorkflowAction,
} from './workflowEvents';

// ─── Core Models ──────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  schemaName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SailsTableDefinition {
  id: string;
  tenantId: string;
  name: string;        // UI display name (e.g., "Sales Leads")
  tableName: string;   // Physical DB name (e.g., "leads")
  description?: string | null;
  isSystem?: boolean;  // Platform system table indicator
  createdAt: string;
  updatedAt?: string;
  fields?: SailsFieldDefinition[];
  rules?: ValidationRule[];
  _count?: { fields: number };
}

export interface SailsFieldDefinition {
  id: string;
  tableId: string;
  name: string;          // UI display name (e.g., "Email Address")
  fieldName: string;     // Physical DB name (e.g., "email")
  physicalType: string;  // DB type: 'text', 'number', 'boolean', 'date', 'relation', 'jsonb'
  logicalType: string;   // UI type: 'short_text', 'email', 'select', 'lookup', etc.
  config?: Record<string, any> | null;
  isRequired: boolean;
  isSystem?: boolean;    // Platform system field indicator
  defaultValue?: string | null;
  description?: string | null;
  createdAt: string;
  rules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  tableId: string;
  fieldId?: string | null;
  ruleType: 'min' | 'max' | 'regex' | 'enum';
  ruleDefinition: string;
  errorMessage?: string | null;
}

export interface Team {
  id: string;
  tenantId: string;
  name: string;
  isSystemAdmin: boolean;
  parentId?: string | null;
}

export interface SailsUser {
  id: string;
  tenantId: string | null;
  email: string;
  name?: string | null;
  image?: string | null;
  role: string;
  isActive: boolean;
  emailVerified: string | null;
  phone?: string | null;
  metadata: Record<string, any>;
  lastLoginAt?: string | null;
  teams?: { team: Team; isLeader: boolean }[];
  createdAt: string;
  updatedAt: string;
}

export interface ObjectPermission {
  id: string;
  teamId: string;
  objectName: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  viewAllData: boolean;
  modifyAllData: boolean;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALTER_SCHEMA';
  objectName: string;
  recordId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  createdAt: string;
}

// ─── API Request Types ────────────────────────────────────────

export interface ProvisionTenantRequest {
  name: string;
  adminEmail: string;
  existingUserId?: string;
  password?: string;
}

export interface ProvisionTenantResponse {
  tenant: Tenant;
  user: SailsUser;
  adminTeam: Team;
}

export interface CreateTableRequest {
  name: string;
  tableName: string;
  description?: string;
}

export interface CreateFieldRequest {
  tableId: string;
  name: string;
  fieldName: string;
  physicalType: string;
  logicalType: string;
  config?: Record<string, any> | null;
  isRequired?: boolean;
}

// ─── UI Config Types ──────────────────────────────────────────

export interface ConsoleMenu {
  id: string;
  appId?: string | null;
  parentId?: string | null;
  label: string;
  icon: string | null;
  path: string | null;
  actionType: string;
  componentKey?: string;
  dataModelId?: string | null;
  listViewId?: string | null;
  order: number;
  isSystem?: boolean;
  requiredCapability?: string | null;
  translationKey?: string | null;
  children?: ConsoleMenu[];
}

export interface ConsoleApp {
  id: string;
  tenantId: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  icon: string | null;
  order: number;
  isSystem?: boolean;
  requiredCapability?: string | null;
  widgetBarEnabled?: boolean;
  translationKey?: string | null;
  menus: ConsoleMenu[];
  widgets?: ConsoleWidget[];
  _count?: { menus: number };
}

export interface ConsoleWidget {
  id: string;
  tenantId?: string;
  appId?: string | null;
  label: string;
  icon: string | null;
  componentKey?: string | null;
  openIn?: string;
  config?: Record<string, any> | null;
  order: number;
  enabled?: boolean;
  isSystem?: boolean;
  requiredCapability?: string | null;
  translationKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Physical Type Enum ───────────────────────────────────────

export const PHYSICAL_TYPES = [
  'text',
  'number',
  'boolean',
  'date',
  'time',
  'relation',
  'jsonb',
] as const;

export type PhysicalType = typeof PHYSICAL_TYPES[number];

// ─── Logical Type Enum ────────────────────────────────────────

export const LOGICAL_TYPES = [
  'short_text',
  'long_text',
  'rich_text',
  'email',
  'phone',
  'number',
  'currency',
  'percentage',
  'boolean',
  'date',
  'decimal',
  'time',
  'datetime',
  'select',
  'lookup',
  'user',
  'address',
  'attachment',
  'lat_lng',
  'auto_number',
  'expression',
] as const;

export const LOGICAL_FIELD_TYPES = LOGICAL_TYPES;

export type LogicalType = typeof LOGICAL_TYPES[number];

// ─── Metadata-Driven Dynamic Parameter Schema Contracts ────────

export interface FieldParameterOption {
  label: string;
  value: any;
  translationKey?: string;
}

export interface FieldParameterDefinition {
  name: string;             // Key in config JSON e.g. "maxLength"
  label: string;            // UI label e.g. "Max Character Length"
  translationKey?: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'model_select' | 'layout_select';
  defaultValue?: any;
  description?: string;
  placeholder?: string;
  options?: FieldParameterOption[];
  min?: number;
  max?: number;
  required?: boolean;
  searchable?: boolean; // Render the select param with a search box (e.g. country lists)
  visibleWhen?: { name: string; equals: any }; // Only show when another param equals a value
}

export interface FieldTypeMetadata {
  type: string;             // Logical type identifier e.g. 'short_text'
  label: string;            // UI Display Label e.g. 'Short Text'
  translationKey?: string;
  description?: string;
  iconName?: string;        // Icon identifier e.g. 'Type', 'Hash'
  physicalType: PhysicalType;
  parametersSchema: FieldParameterDefinition[];
}

// ─── Modular Field Configuration Interfaces ───────────────────

export interface ShortTextFieldConfig {
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string;
  transform?: 'none' | 'uppercase' | 'lowercase';
}

export interface LongTextFieldConfig {
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}

export interface NumberFieldConfig {
  min?: number;
  max?: number;
  defaultValue?: number;
  /** Show thousands separators (e.g. 1,250) in display and edit. Default: true. */
  useThousandSeparator?: boolean;
}

export interface DecimalFieldConfig {
  decimalPlaces?: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  /** Show thousands separators (e.g. 1,250.50) in display and edit. Default: true. */
  useThousandSeparator?: boolean;
}

export interface CurrencyFieldConfig {
  currencySymbol?: string;
  decimalPlaces?: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  /** Show thousands separators (e.g. $1,250.50) in display and edit. Default: true. */
  useThousandSeparator?: boolean;
}

export interface PercentageFieldConfig {
  decimalPlaces?: number;
  min?: number;
  max?: number;
  showSymbol?: boolean;
  /** Show thousands separators (e.g. 1,250.50%) in display and edit. Default: true. */
  useThousandSeparator?: boolean;
}

export interface PhoneFieldConfig {
  defaultCountryCode?: string;
  placeholder?: string;
}

export interface AddressFieldConfig {
  includeCountry?: boolean;
  includePostalCode?: boolean;
  includeStateProvince?: boolean;
  placeholder?: string;
}

export interface AttachmentFieldConfig {
  allowedExtensions?: string; // Comma separated e.g. "pdf, docx, png, jpg"
  maxFileSizeMB?: number;
  allowMultiple?: boolean;
}

export interface BooleanFieldConfig {
  defaultValue?: boolean;
  trueLabel?: string;
  falseLabel?: string;
}

export interface DateFieldConfig {
  dateFormat?: string;
  dateFormatCustom?: string;
  defaultCurrent?: boolean;
}

export interface TimeFieldConfig {
  timeFormat?: string;
  timeFormatCustom?: string;
  defaultCurrent?: boolean;
}

export interface DateTimeFieldConfig {
  dateFormat?: string;
  dateFormatCustom?: string;
  timeFormat?: string;
  timeFormatCustom?: string;
  defaultCurrent?: boolean;
}

export interface SelectFieldConfig {
  sourceType?: 'custom' | 'object'; // Manual options vs lookup from object column
  options?: { label: string; value: string }[];
  sourceTable?: string;
  sourceColumn?: string;
  allowMultiple?: boolean;
  /** Query Studio filter groups applied to the source model when resolving dropdown options. */
  sourceFilter?: FilterGroup[];
}

export interface RelationFieldConfig {
  targetTable?: string;
  /** Display Control: 'searchable_dropdown' | 'select' | 'search_list'. */
  controlStyle?: 'searchable_dropdown' | 'select' | 'search_list';
  /** For search_list: List View (layout id or systemName) of the target model to embed in the picker. */
  listView?: string;
}

export interface EmailFieldConfig {
  placeholder?: string;
  /** Accept comma/semicolon-separated multiple addresses. Default: false. */
  allowMultiple?: boolean;
}

export interface LatLngFieldConfig {
  placeholder?: string;
}

export interface AutoNumberFieldConfig {
  prefix?: string;
  suffix?: string;
  startingNumber?: number;
  digits?: number;
}

export interface ExpressionFieldDependency {
  /** Physical table name of the referenced related data model. */
  targetTable: string;
  /** Field name of the relation/lookup field used to reach the related record(s). */
  relationField: string;
  /** True for rollup references ($related('child','fk')): the FK lives on the
   *  referenced (child) table and points back at this record. */
  reverse?: boolean;
}

export interface ExpressionFieldConfig {
  /** JSONata expression — evaluated server-side on every save. */
  expression?: string;
  /** Physical storage type of the computed result. */
  resultType?: ExpressionResultType;
  /** Relation fields referenced by the expression (used to drive recompute). */
  dependencies?: ExpressionFieldDependency[];
}

export type SailsFieldConfig =
  | ShortTextFieldConfig
  | LongTextFieldConfig
  | NumberFieldConfig
  | DecimalFieldConfig
  | CurrencyFieldConfig
  | PercentageFieldConfig
  | PhoneFieldConfig
  | EmailFieldConfig
  | LatLngFieldConfig
  | AddressFieldConfig
  | AttachmentFieldConfig
  | BooleanFieldConfig
  | DateFieldConfig
  | SelectFieldConfig
  | RelationFieldConfig
  | AutoNumberFieldConfig
  | ExpressionFieldConfig
  | Record<string, any>;

// ─── Page Layout Contracts ─────────────────────────────────────

export type LayoutType = 'data' | 'custom';
export type ViewType = 'LIST' | 'DETAIL' | 'FORM';
export type LayoutStatus = 'draft' | 'active';
export type MobileViewMode = 'table' | 'accordion' | 'card';

export interface TableLayout {
  id: string;
  tableId: string | null;
  layoutType: LayoutType;
  viewType: ViewType;
  name: string;
  systemName: string;
  description?: string | null;
  isDefault: boolean;
  recordTitleField?: string | null;
  config: LayoutConfig;
  publishedConfig: LayoutConfig | null;
  status: LayoutStatus;
  createdAt: string;
  updatedAt: string;
}

/** A layout-level transient variable shared by all form-event chains and
 * condition expressions. Evaluated per page session — never persisted. */
export interface FormVariable {
  id: string;
  name: string;
  fieldType: 'text' | 'number' | 'boolean' | 'date' | 'json' | 'record';
  /** Static default value (used when no expression is set). */
  defaultValue?: any;
  /** JSONata default expression — evaluated with record + vars at chain start. */
  expression?: string;
  /** Include the resolved value in the chain response so the client writes it into formData. */
  exposeToForm?: boolean;
}

export interface LayoutConfig {
  sections?: LayoutSection[];
  fields?: LayoutField[];
  /** Layout-level transient variables (form-event chains + Conditions tab). */
  formVariables?: FormVariable[];
  /** Named groups of behavior / formatting / validation rules (detail view). */
  conditionSets?: ConditionSet[];
  relatedRecords?: RelatedRecord[];    // only for DETAIL view

  // LIST/Table view config
  columns?: LayoutColumn[];
  filters?: FilterGroup[] | LayoutFilter[];  // grouped (Query Studio) or legacy flat
  sortBy?: LayoutSort[];
  summaryFields?: SummaryField[];
  allowMultiSelect?: boolean;
  allowPaging?: boolean;
  recordsPerPage?: number;
  pagingMode?: 'fixed' | 'dynamic';
  /** Allow inline row editing wherever this LIST view renders (page + related blocks). */
  allowInlineEdit?: boolean;
  /** When set, the view's 'create' action opens an inline create row instead of navigating. */
  allowInlineCreate?: boolean;
  /** Allow inline row deletion (with confirmation) wherever this LIST view renders. */
  allowInlineDelete?: boolean;

  // Action buttons (toolbar / context)
  actions?: ListAction[];              // List-level toolbar actions (e.g. Create)
  detailActions?: DetailAction[];      // Detail/Form-level header actions (future)
  /** When false, the Detail View's built-in Edit button is hidden (read-only layouts). */
  allowEdit?: boolean;
  /** Row highlight rules for LIST views (evaluated per record at runtime). */
  rowFormatting?: ConditionalFormatRule[];
}

/**
 * A toolbar-level action on a List View.
 * requiresSelection is always false — these appear regardless of selection state.
 */
export interface ListAction {
  id: string;
  actionKey: string;                 // System or plugin action key (e.g. 'create', 'export_csv')
  label: string;                     // Display label (default from ActionPlugin.defaultLabel)
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  visible: boolean;
  requiresSelection?: boolean;
  iconName?: string;
  /** Optional event chain executed when this toolbar action is clicked. */
  preValidations?: PreValidation[];
  sections?: ActionSection[];
}

/** A validation gate evaluated before an action's event chain runs. */
export interface PreValidation {
  id: string;
  /** JSONata condition — must evaluate truthy for the action to run. */
  expression: string;
  /** Shown to the user when the expression evaluates falsy. */
  message: string;
  /** Legacy structured fields (older drafts) — migrated to `expression` in the studio. */
  fieldId?: string;
  rule?: string;
  value?: string;
}

/** A single step in an action's event chain (reuses workflow event plugin types). */
export interface FormEvent {
  id: string;
  type: 'record' | 'expression' | 'script' | 'notification' | 'notification_message';
  label: string;
  condition?: string;
  storeAs?: string;
  config: Record<string, any>;
}

/** An ordered group of events; a false condition skips the whole section. */
export interface ActionSection {
  id: string;
  title?: string;
  condition?: string;
  events: FormEvent[];
  collapsed?: boolean;
}

/**
 * A header-level action on a Detail / Form view.
 * Plain actions carry only actionKey (e.g. 'delete'); form-event actions carry
 * preValidations + event sections executed on click.
 */
export interface DetailAction {
  id: string;
  actionKey: string;                 // System action key or 'form_event' for custom chains
  label: string;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  visible: boolean;
  iconName?: string;
  /** Validation gates — all must pass before any event runs. */
  preValidations?: PreValidation[];
  /** Ordered event sections executed when the button is clicked. */
  sections?: ActionSection[];
}

/** Control-state flags a behavior rule enforces on its targets when active. */
export interface ConditionSetEffect {
  visible?: boolean;
  readOnly?: boolean;
  editable?: boolean;
}

/** Style a formatting rule applies to its targets when active. */
export interface ConditionSetStyle {
  textColor?: string;
  background?: string;
  bold?: boolean;
  icon?: string;
}

/** One rule inside a Condition Set. */
export interface ConditionSetRule {
  id: string;
  /** Rule-level JSONata gate (record + vars context); empty = always active. */
  condition?: string;
  /** Placed blocks this rule targets, or 'all' (Select All — whole form). */
  targetBlockIds: string[] | 'all';
  kind: 'behavior' | 'formatting' | 'validation';
  effect?: ConditionSetEffect;
  style?: ConditionSetStyle;
  validation?: {
    id: string;
    type: string;
    message?: string;
    pattern?: string;
    min?: number;
    max?: number;
    dependentFieldId?: string;
    dependentOperator?: string;
    dependentValue?: string;
  };
}

/** A named group of rules; the whole set is inactive while `condition` is false. */
export interface ConditionSet {
  id: string;
  title: string;
  /** Set-level JSONata gate (record + vars context). */
  condition?: string;
  rules: ConditionSetRule[];
}

/** A display-style rule evaluated against the record at runtime. */
export interface ConditionalFormatRule {
  id: string;
  conditions: { fieldId: string; operator: string; value?: string; logic?: 'and' | 'or' }[];
  style: { textColor?: string; background?: string; bold?: boolean; icon?: string };
}

export interface LayoutColumn {
  id: string;
  fieldId: string;
  position: number;
  visible: boolean;
  width?: number;
  widthUnit?: 'px' | '%';
  labelOverride?: string;
  allowSorting: boolean;
  allowFiltering: boolean;
  alignment?: 'left' | 'center' | 'right';
  wrapText?: boolean;
  isPrimaryLink?: boolean;
  targetDetailLayoutId?: string;
}

export type AggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface SummaryField {
  id: string;
  fieldId: string;
  /** Aggregation applied by the list engine over all matching rows. */
  aggregate?: AggregateOp;
}

export interface LayoutFilter {
  id: string;
  fieldId: string;
  operator: string;
  value: string;
  logic: 'and' | 'or';
}

/**
 * A single filter rule inside a filter group (tab). Mirrors the Query Studio
 * builder model. `fieldId` references a FieldDefinition id; `operator` is one
 * of eq | neq | gt | gte | lt | lte | contains | is_empty | is_not_empty.
 * `logic` joins this rule to the previous rule in the same group.
 *
 * The right operand is described by `valueSource`:
 *  - 'value'   → compare against a literal `value`
 *  - 'field'   → compare against another field (`refFieldId`) on the same record
 *  - 'record'  → compare against a field (`refFieldId`) of a specific related
 *                record (`refRecordId`) from the LHS relation field's target model
 *  - 'context' → compare against a dynamic macro (`contextMacro`), with optional
 *                N period (`contextN`) for relative date macros
 */
export type FilterValueSource = 'value' | 'field' | 'record' | 'context' | 'workflow';

export interface FilterRule {
  id: string;
  fieldId: string;
  operator: string;
  value: string;
  logic: 'and' | 'or';
  valueSource?: FilterValueSource;
  /** LHS drill path (field ids) through relation/lookup models; fieldId = terminal hop. */
  fieldChain?: string[];
  refFieldId?: string;
  /** RHS field-source drill path (field ids); refFieldId = terminal hop. */
  refFieldChain?: string[];
  refRecordId?: string;
  contextMacro?: string;
  contextN?: number;
  /** 'workflow' source: moustache reference to a workflow variable/context value, e.g. `{{requestor.name}}`. */
  workflowRef?: string;
  /** Display-only: human-readable LHS path, e.g. "Company → Industry". */
  fieldPath?: string;
  /** Display-only: human-readable RHS path. */
  refFieldPath?: string;
}

/** Context macro categories used by the Query Studio context source picker. */
export const CONTEXT_CATEGORIES = [
  {
    category: 'User Context',
    items: [
      { label: 'Current User', value: '@me' },
      { label: 'Current User Team', value: '@my_team' },
      { label: 'Current User Role', value: '@user.role' },
      { label: 'My Subordinates', value: '@my_subordinates' }
    ]
  },
  {
    category: 'Fixed Date Macros',
    items: [
      { label: 'Today', value: '@today' },
      { label: 'Yesterday', value: '@yesterday' },
      { label: 'Tomorrow', value: '@tomorrow' },
      { label: 'This Week', value: '@this_week' },
      { label: 'This Month', value: '@this_month' },
      { label: 'This Quarter', value: '@this_quarter' },
      { label: 'This Year', value: '@this_year' },
      { label: 'This Fiscal Quarter', value: '@this_fiscal_quarter' },
      { label: 'This Fiscal Year', value: '@this_fiscal_year' }
    ]
  },
  {
    category: 'Dynamic Relative N-Period Macros',
    items: [
      { label: 'Next N Days', value: '@next_n_days' },
      { label: 'Last N Days', value: '@last_n_days' },
      { label: 'Next N Weeks', value: '@next_n_weeks' },
      { label: 'Last N Weeks', value: '@last_n_weeks' },
      { label: 'Next N Months', value: '@next_n_months' },
      { label: 'Last N Months', value: '@last_n_months' },
      { label: 'Next N Years', value: '@next_n_years' },
      { label: 'Last N Years', value: '@last_n_years' },
      { label: 'Next N Fiscal Quarters', value: '@next_n_fiscal_quarters' },
      { label: 'Last N Fiscal Quarters', value: '@last_n_fiscal_quarters' },
      { label: 'Next N Fiscal Years', value: '@next_n_fiscal_years' },
      { label: 'Last N Fiscal Years', value: '@last_n_fiscal_years' }
    ]
  }
];

export const CONTEXT_FLAT_OPTIONS = CONTEXT_CATEGORIES.flatMap((cat) => [
  { value: `cat_${cat.category}`, label: `\u2500\u2500 ${cat.category} \u2500\u2500`, disabled: true },
  ...cat.items.map((item) => ({ value: item.value, label: item.label }))
]);

const N_PERIOD_MACROS = new Set([
  '@next_n_days', '@last_n_days',
  '@next_n_weeks', '@last_n_weeks',
  '@next_n_months', '@last_n_months',
  '@next_n_years', '@last_n_years',
  '@next_n_fiscal_quarters', '@last_n_fiscal_quarters',
  '@next_n_fiscal_years', '@last_n_fiscal_years'
]);

export function isNPeriodMacro(macroValue: string): boolean {
  return N_PERIOD_MACROS.has(macroValue);
}

/**
 * A group of filter rules — rendered as one tab in the Query Studio builder,
 * equivalent to a parenthesized block: (rule1 AND rule2). `groupLogic` joins
 * this group to the previous group (tab).
 */
export interface FilterGroup {
  id: string;
  name: string;
  groupLogic: 'and' | 'or';
  rules: FilterRule[];
}

export interface LayoutSort {
  fieldId: string;
  direction: 'asc' | 'desc';
}

export interface LayoutSection {
  id: string;
  title: string;
  position: number;
  columns: number;                    // 1–4 columns in this section
  showHeader?: boolean;               // default: true — render the section header in preview/runtime
  collapsible?: boolean;              // default: false — allow collapse/expand toggle
  collapsed?: boolean;                // runtime persisted collapsed state
}

export interface LayoutField {
  fieldId: string;                    // FK → FieldDefinition.id
  sectionId: string;
  position: number;
  width: 'full' | 'half' | 'third' | 'quarter';
  visible: boolean;
  readOnly?: boolean;                 // only matters in FORM view
  labelOverride?: string;
}

export interface RelatedRecord {
  tableId: string;                    // FK → TableDefinition.id of child table
  fieldId: string;                    // FK → FieldDefinition (the relation field)
  displayFields: string[];            // which child fields to show in the inline list
  maxRows?: number;                   // how many rows to preview
  orderBy?: string;                   // child field to sort by
}

// ─── Zoning & Multi-Database Multi-Tenancy Contracts ────────────

export type ZoneHealthStatus = 'healthy' | 'degraded' | 'critical' | 'maintenance';
export type PlatformMode = 'standalone' | 'zoned';

export interface GlobalZoneDto {
  id: string;             // e.g. "zone-us-01"
  name: string;           // e.g. "US Primary Cluster"
  apiUrl: string;         // e.g. "https://api-us01.sails.app"
  region: string;         // e.g. "us-east-1"
  maxTenants: number;
  currentTenants: number;
  status: ZoneHealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalTenantDto {
  id: string;             // CUID
  name: string;
  slug: string;
  domain?: string | null;
  zoneId: string;
  status: 'ACTIVE' | 'MIGRATING' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface ZoneTelemetryPayload {
  zoneId: string;
  status: ZoneHealthStatus;
  memoryUsageMB: number;
  activeDbConnections: number;
  tenantCount: number;
  errorCount15m: number;
  uptimeSeconds: number;
  timestamp: string;
}

// ─── Naming & Field Standardization Helpers ───────────────────

/**
 * Utility: Standardize string identifiers to snake_case
 * E.g. "Email Address" ➔ "email_address", "Is Active Customer" ➔ "is_active_customer"
 */
export const toSnakeCase = (str: string): string => {
  if (!str) return '';
  return str
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
};

/**
 * Standard audit/system field identifiers across SAILS Platform
 */
export const SYSTEM_FIELDS = new Set([
  'id',
  'tenant_id',
  'is_system',
  'is_active',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'owner_id',
  'owner_team_id'
]);

/**
 * Columns that are owned by the platform and must NEVER be set from client
 * payloads on insert/update. Server-side enforcement lives in QueryLayer
 * (insertRecord / updateRecord) — the UI mirrors this for read-only rendering.
 */
export const SYSTEM_PROTECTED_COLUMNS = [
  'id',
  'tenant_id',
  'is_system',
  'is_active',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'owner_id',
  'owner_team_id'
];

/**
 * Helper: Check if a field name matches a platform system/audit field,
 * normalizing both camelCase ('isSystem') and snake_case ('is_system') inputs.
 */
export const isSystemField = (fieldName?: string | null): boolean => {
  if (!fieldName) return false;
  const normalized = toSnakeCase(fieldName);
  const cleanTarget = normalized.replace(/_/g, '');
  return SYSTEM_FIELDS.has(normalized) || Array.from(SYSTEM_FIELDS).some(sys => sys.replace(/_/g, '') === cleanTarget);
};

// ─── Date / Time Formatting ────────────────────────────────────

const WEEKDAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Parse a field value (JS Date, ISO string, "YYYY-MM-DD", "YYYY-MM-DD HH:mm[:ss]",
 * "HH:mm[:ss]") into a Date. Returns null for empty/invalid input.
 */
export const parseDateTimeValue = (value: any): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const str = value.trim();
  if (!str) return null;

  // Time-only: "HH:mm[:ss]"
  const timeOnly = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const h = parseInt(timeOnly[1], 10);
    const m = parseInt(timeOnly[2], 10);
    const s = timeOnly[3] ? parseInt(timeOnly[3], 10) : 0;
    if (h > 23 || m > 59 || s > 59) return null;
    return new Date(1970, 0, 1, h, m, s);
  }

  // Date with optional time: "YYYY-MM-DD[ T]HH:mm[:ss][Z|±HH:mm]"
  const parts = str.split('T').length === 2 ? str.split('T') : (str.includes(' ') ? [str.slice(0, str.indexOf(' ')), str.slice(str.indexOf(' ') + 1)] : [str]);
  const datePart = parts[0];
  const dateMatch = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = parseInt(dateMatch[3], 10);
    const timePart = parts[1]?.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timePart) {
      const h = parseInt(timePart[1], 10);
      const m = parseInt(timePart[2], 10);
      const s = timePart[3] ? parseInt(timePart[3], 10) : 0;
      return new Date(year, month, day, h, m, s);
    }
    return new Date(year, month, day);
  }

  // Last resort: ISO string via Date constructor
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Format a Date (or parseable value) using moment-style tokens.
 * Supported tokens: YYYY YY MMMM MMM MM M dddd ddd DD D HH H hh h mm ss A a
 * Unknown tokens are preserved verbatim so literals like "-", "/" work.
 */
export const formatDateTokens = (date: Date, format: string): string => {
  const tokens: Record<string, string> = {
    'YYYY': String(date.getFullYear()),
    'YY': String(date.getFullYear()).slice(-2),
    'MMMM': MONTH_NAMES_FULL[date.getMonth()],
    'MMM': MONTH_NAMES_SHORT[date.getMonth()],
    'MM': pad2(date.getMonth() + 1),
    'M': String(date.getMonth() + 1),
    'dddd': WEEKDAY_NAMES_FULL[date.getDay()],
    'ddd': WEEKDAY_NAMES_SHORT[date.getDay()],
    'DD': pad2(date.getDate()),
    'D': String(date.getDate()),
    'HH': pad2(date.getHours()),
    'H': String(date.getHours()),
    'hh': pad2(date.getHours() % 12 === 0 ? 12 : date.getHours() % 12),
    'h': String(date.getHours() % 12 === 0 ? 12 : date.getHours() % 12),
    'mm': pad2(date.getMinutes()),
    'ss': pad2(date.getSeconds()),
    'A': date.getHours() < 12 ? 'AM' : 'PM',
    'a': date.getHours() < 12 ? 'am' : 'pm',
  };
  return format.replace(/YYYY|YY|MMMM|MMM|dddd|ddd|HH|hh|mm|ss|MM|DD|M|D|H|h|A|a/g, (t) => tokens[t] ?? t);
};

/**
 * Resolve the effective format token string from a field's config.
 * Handles 'custom' selections falling back to the *Custom text parameter.
 */
export const resolveDateTimeFormat = (config: Record<string, any> | null | undefined, logicalType: string): string => {
  const cfg = config || {};
  const isDateType = logicalType === 'date' || logicalType === 'datetime' || logicalType === 'timestamp';

  let dateFmt = '';
  if (isDateType) {
    const raw = cfg.dateFormat || 'YYYY-MM-DD';
    dateFmt = raw === 'custom' ? (cfg.dateFormatCustom || 'YYYY-MM-DD') : raw;
  }

  const isTimeType = logicalType === 'time' || logicalType === 'datetime' || logicalType === 'timestamp';
  let timeFmt = '';
  if (isTimeType) {
    const raw = cfg.timeFormat || '24h';
    if (raw === 'custom') {
      timeFmt = cfg.timeFormatCustom || 'HH:mm';
    } else if (raw === '12h') {
      timeFmt = 'hh:mm A';
    } else {
      timeFmt = 'HH:mm';
    }
  }

  if (logicalType === 'datetime' || logicalType === 'timestamp') {
    const d = dateFmt ? dateFmt : 'YYYY-MM-DD';
    const t = timeFmt ? timeFmt : 'HH:mm';
    return `${d} ${t}`;
  }
  if (logicalType === 'date') return dateFmt;
  if (logicalType === 'time') return timeFmt;
  return dateFmt || timeFmt;
};

/**
 * Format a record value for display using the field's configured date/time format.
 * Returns '' for empty/invalid values so callers can render their own placeholder.
 */
export const formatDateTimeValue = (value: any, config: Record<string, any> | null | undefined, logicalType: string): string => {
  const date = parseDateTimeValue(value);
  if (!date) return '';
  return formatDateTokens(date, resolveDateTimeFormat(config, logicalType));
};

// ─── Filter helpers ─────────────────────────────────────────────

const EMPTY_VALUE_OPS = new Set(['is_empty', 'is_not_empty']);

/** True when a filter rule carries no usable comparison operand. */
export function isFilterRuleEmpty(rule: FilterRule): boolean {
  if (EMPTY_VALUE_OPS.has(rule.operator || '')) return false;
  const source = rule.valueSource || 'value';
  if (source === 'field') return !rule.refFieldId;
  if (source === 'record') return !rule.refFieldId || !rule.refRecordId;
  if (source === 'context') return !rule.contextMacro;
  if (source === 'workflow') return !rule.workflowRef;
  return rule.value === undefined || rule.value === null || String(rule.value).trim() === '';
}

/**
 * Normalize any persisted filters shape into Query Studio FilterGroup[].
 * - undefined/null → a single empty group (builder-ready)
 * - FilterGroup[]   → returned as-is (a group is detected by having `rules`)
 * - legacy LayoutFilter[] (flat) → wrapped into one AND group
 */
export function normalizeFilters(filters: FilterGroup[] | LayoutFilter[] | undefined | null): FilterGroup[] {
  if (!filters || filters.length === 0) {
    return [{ id: 'grp_1', name: '1', groupLogic: 'and', rules: [] }];
  }
  // Group format: every item carries a `rules` array.
  if (filters.every((f) => Array.isArray((f as FilterGroup).rules))) {
    return filters as FilterGroup[];
  }
  const flat = filters as LayoutFilter[];
  return [{
    id: 'grp_1',
    name: '1',
    groupLogic: 'and',
    rules: flat.map((f) => ({ id: f.id, fieldId: f.fieldId, operator: f.operator || 'eq', value: f.value ?? '', logic: f.logic || 'and' })),
  }];
}

/** Serialized filter rule payload sent to /api/dynamic (field names, not ids). */
export interface SerializedFilterRule {
  field: string;
  operator: string;
  value: string;
  logic: 'and' | 'or';
  /** LHS drill path as physical column names; chain[0] is on the root table. */
  chain?: string[];
  refField?: string;
  /** RHS field-source drill path as physical column names. */
  refChain?: string[];
  refRecordId?: string;
  contextN?: number;
  /** 'workflow' source: the moustache reference to resolve at runtime. */
  workflowRef?: string;
}

/** Serialize groups into the API-ready filterGroups param (field names, not ids). */
export function serializeFilterGroups(
  groups: FilterGroup[],
  resolveFieldName: (fieldId: string) => string | null
): { groupLogic: 'and' | 'or'; rules: SerializedFilterRule[] }[] {
  const out: { groupLogic: 'and' | 'or'; rules: SerializedFilterRule[] }[] = [];
  for (const grp of groups || []) {
    const rules: SerializedFilterRule[] = [];
    for (const rule of grp.rules || []) {
      if (isFilterRuleEmpty(rule)) continue;
      const source = rule.valueSource || 'value';

      // LHS drill chain: resolve every hop (field ids → physical names).
      const lhsChainIds = rule.fieldChain && rule.fieldChain.length > 0 ? rule.fieldChain : [rule.fieldId];
      const chain: string[] = [];
      for (const id of lhsChainIds) {
        // The record's ID (UUID) resolves even though metadata excludes it.
        const name = resolveFieldName(id) || (id === 'id' ? 'id' : null);
        if (!name) break;
        chain.push(name);
      }
      if (chain.length === 0) continue;
      const fieldName = chain[chain.length - 1];
      const base = {
        field: fieldName,
        operator: rule.operator || 'eq',
        value: String(rule.value ?? ''),
        logic: rule.logic || 'and',
      };

      if (source === 'field') {
        const refChainIds = rule.refFieldChain && rule.refFieldChain.length > 0 ? rule.refFieldChain : [rule.refFieldId || ''];
        const refChain: string[] = [];
        for (const id of refChainIds) {
          const name = id ? (resolveFieldName(id) || (id === 'id' ? 'id' : null)) : null;
          if (!name) break;
          refChain.push(name);
        }
        if (refChain.length === 0) continue;
        rules.push({ ...base, value: '', chain, refChain, refField: refChain[0] });
      } else if (source === 'record') {
        const refFieldName = rule.refFieldId ? (resolveFieldName(rule.refFieldId) || (rule.refFieldId === 'id' ? 'id' : null)) : null;
        if (!refFieldName || !rule.refRecordId) continue;
        rules.push({ ...base, value: '', chain, refField: refFieldName, refRecordId: rule.refRecordId });
      } else if (source === 'context') {
        if (!rule.contextMacro) continue;
        rules.push({ ...base, value: rule.contextMacro, chain, contextN: rule.contextN });
      } else if (source === 'workflow') {
        if (!rule.workflowRef) continue;
        rules.push({ ...base, value: '', chain, workflowRef: rule.workflowRef });
      } else {
        rules.push({ ...base, chain });
      }
    }
    if (rules.length > 0) {
      out.push({ groupLogic: grp.groupLogic || 'and', rules });
    }
  }
  return out;
}




