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

export { FIELD_TYPE_REGISTRY } from './fieldTypes';
export { SYSTEM_PERMISSION_REGISTRY, getAllCapabilities } from './permissions';
export type { PermissionDefinition, SystemCapability } from './permissions';

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
  'citizen_id',
  'lat_lng',
  'auto_number',
] as const;

export const LOGICAL_FIELD_TYPES = LOGICAL_TYPES;

export type LogicalType = typeof LOGICAL_TYPES[number];

// ─── Metadata-Driven Dynamic Parameter Schema Contracts ────────

export interface FieldParameterOption {
  label: string;
  value: any;
}

export interface FieldParameterDefinition {
  name: string;             // Key in config JSON e.g. "maxLength"
  label: string;            // UI label e.g. "Max Character Length"
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'model_select';
  defaultValue?: any;
  description?: string;
  placeholder?: string;
  options?: FieldParameterOption[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface FieldTypeMetadata {
  type: string;             // Logical type identifier e.g. 'short_text'
  label: string;            // UI Display Label e.g. 'Short Text'
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
}

export interface CurrencyFieldConfig {
  currencySymbol?: string;
  decimalPlaces?: number;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export interface PercentageFieldConfig {
  decimalPlaces?: number;
  min?: number;
  max?: number;
  showSymbol?: boolean;
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
  defaultCurrent?: boolean;
}

export interface SelectFieldConfig {
  sourceType?: 'custom' | 'object'; // Manual options vs lookup from object column
  options?: { label: string; value: string }[];
  sourceTable?: string;
  sourceColumn?: string;
  allowMultiple?: boolean;
}

export interface RelationFieldConfig {
  targetTable?: string;
  relationType?: 'one_to_many' | 'many_to_one' | 'one_to_one';
}

export interface AutoNumberFieldConfig {
  prefix?: string;
  suffix?: string;
  startingNumber?: number;
  digits?: number;
}

export type SailsFieldConfig =
  | ShortTextFieldConfig
  | LongTextFieldConfig
  | NumberFieldConfig
  | CurrencyFieldConfig
  | PercentageFieldConfig
  | PhoneFieldConfig
  | AddressFieldConfig
  | AttachmentFieldConfig
  | BooleanFieldConfig
  | DateFieldConfig
  | SelectFieldConfig
  | RelationFieldConfig
  | AutoNumberFieldConfig
  | Record<string, any>;

// ─── Page Layout Contracts ─────────────────────────────────────

export type LayoutType = 'data' | 'custom';
export type ViewType = 'LIST' | 'DETAIL' | 'FORM';
export type LayoutStatus = 'draft' | 'active';

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

export interface LayoutConfig {
  sections?: LayoutSection[];
  fields?: LayoutField[];
  relatedRecords?: RelatedRecord[];    // only for DETAIL view

  // LIST/Table view config
  columns?: LayoutColumn[];
  filters?: LayoutFilter[];
  sortBy?: LayoutSort[];
  summaryFields?: SummaryField[];
  allowMultiSelect?: boolean;
  allowPaging?: boolean;
  recordsPerPage?: number;
  pagingMode?: 'fixed' | 'dynamic';

  // Action buttons (toolbar / context)
  actions?: ListAction[];              // List-level toolbar actions (e.g. Create)
  detailActions?: DetailAction[];      // Detail/Form-level header actions (future)
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
}

/**
 * A header-level action on a Detail / Form view. (Reserved for future sprint)
 */
export interface DetailAction {
  id: string;
  actionKey: 'edit' | 'clone' | 'delete' | 'archive';
  label: string;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  visible: boolean;
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

export interface SummaryField {
  id: string;
  fieldId: string;
}

export interface LayoutFilter {
  id: string;
  fieldId: string;
  operator: string;
  value: string;
  logic: 'and' | 'or';
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
  collapsed?: boolean;
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



