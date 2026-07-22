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
  createdAt: string;
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
  requiredCapability?: string | null;
  children?: ConsoleMenu[];
}

export interface ConsoleApp {
  id: string;
  tenantId: string;
  name: string;
  icon: string | null;
  order: number;
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
  'boolean',
  'date',
  'datetime',
  'select',
  'lookup',
  'citizen_id',
  'lat_lng',
] as const;

export type LogicalType = typeof LOGICAL_TYPES[number];
