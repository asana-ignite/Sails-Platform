/**
 * KLAO Shared Types — API Contract
 * 
 * This file defines all TypeScript interfaces used between
 * KLAO Core (Backend) and KLAO Console (Frontend).
 * 
 * Both projects should reference these types to ensure
 * type-safe communication across the API boundary.
 * 
 * Source of truth: klao-core/shared/types.ts
 */

// ─── Core Models ──────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  schemaName: string;
  createdAt: string;
  updatedAt: string;
}

export interface KlaoTableDefinition {
  id: string;
  tenantId: string;
  name: string;        // UI display name (e.g., "Sales Leads")
  tableName: string;   // Physical DB name (e.g., "leads")
  description?: string | null;
  isSystem?: boolean;  // Platform system table indicator
  createdAt: string;
  updatedAt?: string;
  fields?: KlaoFieldDefinition[];
  rules?: ValidationRule[];
  _count?: { fields: number };
}

export interface KlaoFieldDefinition {
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

export interface KlaoUser {
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
  user: KlaoUser;
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
  order: number;
  isSystem?: boolean;
  requiredCapability?: string | null;
  children?: ConsoleMenu[];
}

export interface ConsoleApp {
  id: string;
  tenantId: string;
  name: string;
  icon: string | null;
  order: number;
  isSystem?: boolean;
  requiredCapability?: string | null;
  menus: ConsoleMenu[];
  _count?: { menus: number };
}

// ─── Physical Type Enum ───────────────────────────────────────

export const PHYSICAL_TYPES = [
  'text',
  'number',
  'boolean',
  'date',
  'relation',
  'jsonb',
] as const;

export type PhysicalType = typeof PHYSICAL_TYPES[number];

// ─── Logical Type Enum ────────────────────────────────────────

export const LOGICAL_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'number',
  'currency',
  'percentage',
  'boolean',
  'date',
  'datetime',
  'select',
  'lookup',
  'address',
  'attachment',
  'citizen_id',
  'lat_lng',
  'auto_number',
] as const;

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
  numberType?: 'integer' | 'decimal';
  decimalPlaces?: number;
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

export type KlaoFieldConfig =
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


