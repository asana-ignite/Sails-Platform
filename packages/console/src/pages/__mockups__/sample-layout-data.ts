/**
 * MOCK UP — Sample Page Layout Data
 * 
 * This file demonstrates the full shape of TableLayout configs
 * for a "Leads" table. In production, this data lives in PostgreSQL
 * (core.table_layouts) and is fetched via the API.
 */
import type { TableLayout, SailsFieldDefinition } from '@sails/shared';

// ─── Dummy fields that exist on the "Leads" table ──────────────

export const MOCK_LEADS_FIELDS: SailsFieldDefinition[] = [
  { id: 'f_001', tableId: 't_leads', name: 'Lead Name',       fieldName: 'lead_name',       physicalType: 'text',    logicalType: 'short_text', config: {}, isRequired: true,  isSystem: false, createdAt: '' },
  { id: 'f_002', tableId: 't_leads', name: 'Company',         fieldName: 'company',         physicalType: 'text',    logicalType: 'short_text', config: {}, isRequired: false, isSystem: false, createdAt: '' },
  { id: 'f_003', tableId: 't_leads', name: 'Email',           fieldName: 'email',           physicalType: 'text',    logicalType: 'email',      config: {}, isRequired: true,  isSystem: false, createdAt: '' },
  { id: 'f_004', tableId: 't_leads', name: 'Phone',           fieldName: 'phone',           physicalType: 'text',    logicalType: 'phone',      config: {}, isRequired: false, isSystem: false, createdAt: '' },
  { id: 'f_005', tableId: 't_leads', name: 'Status',          fieldName: 'status',          physicalType: 'text',    logicalType: 'select',     config: { options: [{ label:'New', value:'new' },{ label:'Contacted', value:'contacted' },{ label:'Qualified', value:'qualified' },{ label:'Lost', value:'lost' }] }, isRequired: true,  isSystem: false, createdAt: '' },
  { id: 'f_006', tableId: 't_leads', name: 'Source',          fieldName: 'source',          physicalType: 'text',    logicalType: 'select',     config: { options: [{ label:'Website', value:'website' },{ label:'Referral', value:'referral' },{ label:'Event', value:'event' }] }, isRequired: false, isSystem: false, createdAt: '' },
  { id: 'f_007', tableId: 't_leads', name: 'Budget',          fieldName: 'budget',          physicalType: 'number',  logicalType: 'currency',   config: { currencySymbol:'฿', decimalPlaces:0 }, isRequired: false, isSystem: false, createdAt: '' },
  { id: 'f_008', tableId: 't_leads', name: 'Contact Date',    fieldName: 'contact_date',    physicalType: 'date',    logicalType: 'date',       config: {}, isRequired: false, isSystem: false, createdAt: '' },
  { id: 'f_009', tableId: 't_leads', name: 'Notes',           fieldName: 'notes',           physicalType: 'text',    logicalType: 'long_text',  config: { rows:4 }, isRequired: false, isSystem: false, createdAt: '' },
  { id: 'f_010', tableId: 't_leads', name: 'Assigned To',     fieldName: 'assigned_to',     physicalType: 'relation',logicalType: 'lookup',     config: { targetTable:'users' }, isRequired: false, isSystem: false, createdAt: '' },
];

// ─── Layout: LIST view — compact table with key columns ───────

export const MOCK_LAYOUT_LIST: TableLayout = {
  id: 'l_list_001',
  tableId: 't_leads',
  layoutType: 'data',
  systemName: 'default_list_view',
  viewType: 'LIST',
  name: 'Default List View',
  isDefault: true,
  recordTitleField: 'lead_name',
  publishedConfig: null,
  status: 'active',
  config: {
    sections: [
      { id: 's_list_main', title: 'All Leads', position: 0, columns: 1, collapsed: false },
    ],
    fields: [
      { fieldId: 'f_001', sectionId: 's_list_main', position: 0, width: 'full', visible: true },
      { fieldId: 'f_002', sectionId: 's_list_main', position: 1, width: 'full', visible: true },
      { fieldId: 'f_003', sectionId: 's_list_main', position: 2, width: 'full', visible: true },
      { fieldId: 'f_005', sectionId: 's_list_main', position: 3, width: 'full', visible: true },
      { fieldId: 'f_006', sectionId: 's_list_main', position: 4, width: 'full', visible: true },
      { fieldId: 'f_007', sectionId: 's_list_main', position: 5, width: 'full', visible: true },
      { fieldId: 'f_008', sectionId: 's_list_main', position: 6, width: 'full', visible: true },
      { fieldId: 'f_010', sectionId: 's_list_main', position: 7, width: 'full', visible: true },
    ],
  },
  createdAt: '',
  updatedAt: '',
};

// ─── Layout: DETAIL view — read-only, sections + related records

export const MOCK_LAYOUT_DETAIL: TableLayout = {
  id: 'l_detail_001',
  tableId: 't_leads',
  layoutType: 'data',
  systemName: 'default_detail_view',
  viewType: 'DETAIL',
  name: 'Default Detail View',
  isDefault: true,
  recordTitleField: 'lead_name',
  publishedConfig: null,
  status: 'active',
  config: {
    sections: [
      { id: 's_primary',   title: 'Primary Info',       position: 0, columns: 2, collapsed: false },
      { id: 's_financial', title: 'Financial & Status',  position: 1, columns: 2, collapsed: false },
      { id: 's_details',   title: 'Additional Details',  position: 2, columns: 1, collapsed: false },
    ],
    fields: [
      // Primary Info section (2-column grid)
      { fieldId: 'f_001', sectionId: 's_primary',   position: 0, width: 'half',   visible: true },
      { fieldId: 'f_002', sectionId: 's_primary',   position: 1, width: 'half',   visible: true },
      { fieldId: 'f_003', sectionId: 's_primary',   position: 2, width: 'half',   visible: true },
      { fieldId: 'f_004', sectionId: 's_primary',   position: 3, width: 'half',   visible: true },
      // Financial & Status section (2-column grid)
      { fieldId: 'f_005', sectionId: 's_financial', position: 0, width: 'half',   visible: true },
      { fieldId: 'f_006', sectionId: 's_financial', position: 1, width: 'half',   visible: true },
      { fieldId: 'f_007', sectionId: 's_financial', position: 2, width: 'half',   visible: true },
      // Additional Details (full-width)
      { fieldId: 'f_008', sectionId: 's_details',   position: 0, width: 'half',   visible: true },
      { fieldId: 'f_010', sectionId: 's_details',   position: 1, width: 'half',   visible: true },
      { fieldId: 'f_009', sectionId: 's_details',   position: 2, width: 'full',   visible: true },
    ],
    relatedRecords: [
      {
        tableId: 't_tasks',
        fieldId: 'f_task_relation',
        displayFields: ['title', 'status', 'due_date'],
        maxRows: 5,
        orderBy: 'due_date',
      },
      {
        tableId: 't_contacts',
        fieldId: 'f_contact_relation',
        displayFields: ['name', 'email', 'phone'],
        maxRows: 10,
        orderBy: 'name',
      },
    ],
  },
  createdAt: '',
  updatedAt: '',
};

// ─── Layout: FORM view — fields laid out for data entry ────────

export const MOCK_LAYOUT_FORM: TableLayout = {
  id: 'l_form_001',
  tableId: 't_leads',
  layoutType: 'data',
  systemName: 'default_form',
  viewType: 'FORM',
  name: 'Default Form',
  isDefault: true,
  recordTitleField: 'lead_name',
  publishedConfig: null,
  status: 'active',
  config: {
    sections: [
      { id: 's_form_main', title: 'Lead Information', position: 0, columns: 2, collapsed: false },
    ],
    fields: [
      { fieldId: 'f_001', sectionId: 's_form_main', position: 0, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_002', sectionId: 's_form_main', position: 1, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_003', sectionId: 's_form_main', position: 2, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_004', sectionId: 's_form_main', position: 3, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_005', sectionId: 's_form_main', position: 4, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_006', sectionId: 's_form_main', position: 5, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_007', sectionId: 's_form_main', position: 6, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_008', sectionId: 's_form_main', position: 7, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_010', sectionId: 's_form_main', position: 8, width: 'half', visible: true, readOnly: false },
      { fieldId: 'f_009', sectionId: 's_form_main', position: 9, width: 'full', visible: true, readOnly: false, labelOverride: 'Additional Notes' },
    ],
  },
  createdAt: '',
  updatedAt: '',
};
