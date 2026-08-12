/**
 * ReportDesigner — visual report/formula builder (mockup-grade).
 */
import React, { useReducer, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useConsole } from '../../contexts/ConsoleContext';
import {
  Table2, BarChart3, Plus, Save, Download, Trash2, GripVertical, X,
  Filter, Sigma, Hash, Calendar, Type, DollarSign, ChevronDown, ChevronRight,
  FileText, Copy, Eye, EyeOff, RotateCcw, LayoutGrid, LayoutList, Play,
  Database, UserPlus, Users, Building2, Briefcase, Clock, TrendingUp, AlignLeft,
} from 'lucide-react';
import './ReportDesigner.css';

/* ───────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────── */

interface RDField {
  tableId: string;
  tableName: string;
  fieldName: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'currency' | 'number' | 'date' | 'select' | 'percent';
  options?: string[];
}

interface RDTable {
  id: string;
  name: string;
  icon: string;
  fields: RDField[];
}

type Aggregation = 'sum' | 'count' | 'avg' | 'min' | 'max';
type SortDir = 'asc' | 'desc' | 'none';

interface ZoneField {
  instanceId: string;
  field: RDField;
  aggregation: Aggregation;
  sort: SortDir;
}

interface ReportFilter {
  instanceId: string;
  field: RDField;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'is_empty' | 'is_not_empty';
  value: string;
  value2: string;
}

interface ReportFormula {
  id: string;
  name: string;
  expression: string;
  returnType: 'number' | 'text' | 'currency' | 'date';
}

interface SavedReport {
  id: string;
  name: string;
  dataSource: string;
  viewMode: 'tabular' | 'pivot';
  columns: ZoneField[];
  rows: ZoneField[];
  values: ZoneField[];
  filters: ReportFilter[];
  formulas: ReportFormula[];
}

interface RDState {
  reports: SavedReport[];
  activeReportId: string | null;
  viewMode: 'tabular' | 'pivot';
  columns: ZoneField[];
  rows: ZoneField[];
  values: ZoneField[];
  filters: ReportFilter[];
  formulas: ReportFormula[];
  showFormulaEditor: boolean;
  editingFormulaId: string | null;
}

/* ───────────────────────────────────────────────
   Mock Data
   ─────────────────────────────────────────────── */

const MOCK_TABLES: RDTable[] = [
  {
    id: 'leads', name: 'Leads', icon: 'UserPlus',
    fields: [
      { tableId: 'leads', tableName: 'Leads', fieldName: 'full_name', label: 'Full Name', type: 'text' },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'email', label: 'Email', type: 'email' },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'phone', label: 'Phone', type: 'phone' },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Lost', 'Nurturing'] },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'source', label: 'Source', type: 'select', options: ['Website', 'Referral', 'Event', 'Cold Call', 'Social Media'] },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'created_at', label: 'Created Date', type: 'date' },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'score', label: 'Lead Score', type: 'number' },
      { tableId: 'leads', tableName: 'Leads', fieldName: 'owner', label: 'Assigned To', type: 'text' },
    ],
  },
  {
    id: 'deals', name: 'Deals', icon: 'Briefcase',
    fields: [
      { tableId: 'deals', tableName: 'Deals', fieldName: 'name', label: 'Deal Name', type: 'text' },
      { tableId: 'deals', tableName: 'Deals', fieldName: 'amount', label: 'Amount', type: 'currency' },
      { tableId: 'deals', tableName: 'Deals', fieldName: 'stage', label: 'Stage', type: 'select', options: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] },
      { tableId: 'deals', tableName: 'Deals', fieldName: 'close_date', label: 'Close Date', type: 'date' },
      { tableId: 'deals', tableName: 'Deals', fieldName: 'probability', label: 'Probability', type: 'percent' },
      { tableId: 'deals', tableName: 'Deals', fieldName: 'contact_name', label: 'Contact', type: 'text' },
      { tableId: 'deals', tableName: 'Deals', fieldName: 'pipeline', label: 'Pipeline', type: 'select', options: ['Enterprise', 'Mid-Market', 'SMB'] },
    ],
  },
  {
    id: 'contacts', name: 'Contacts', icon: 'Users',
    fields: [
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'first_name', label: 'First Name', type: 'text' },
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'last_name', label: 'Last Name', type: 'text' },
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'email', label: 'Email', type: 'email' },
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'title', label: 'Job Title', type: 'text' },
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'company', label: 'Company', type: 'text' },
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'phone', label: 'Phone', type: 'phone' },
      { tableId: 'contacts', tableName: 'Contacts', fieldName: 'type', label: 'Type', type: 'select', options: ['Customer', 'Prospect', 'Partner', 'Vendor'] },
    ],
  },
  {
    id: 'accounts', name: 'Accounts', icon: 'Building2',
    fields: [
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'name', label: 'Account Name', type: 'text' },
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'industry', label: 'Industry', type: 'select', options: ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education'] },
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'annual_revenue', label: 'Annual Revenue', type: 'currency' },
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'employees', label: 'Employees', type: 'number' },
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'country', label: 'Country', type: 'text' },
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'On Hold', 'Churned'] },
      { tableId: 'accounts', tableName: 'Accounts', fieldName: 'created_at', label: 'Created Date', type: 'date' },
    ],
  },
];

const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda', 'David', 'Barbara', 'Richard', 'Elizabeth', 'Joseph', 'Susan', 'Thomas', 'Jessica'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
const COMPANIES = ['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella Co', 'Stark Industries', 'Wayne Enterprises', 'Cyberdyne', 'Massive Dynamic', 'Hooli', 'Pied Piper', 'Dunder Mifflin', 'Sterling Cooper'];
const CITIES = ['New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle', 'Boston', 'Denver', 'Miami', 'Portland', 'Atlanta'];
const PIPELINES = ['Enterprise', 'Mid-Market', 'SMB'];
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const SOURCES = ['Website', 'Referral', 'Event', 'Cold Call', 'Social Media'];
const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education'];
const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost', 'Nurturing'];
const ACCT_STATUSES = ['Active', 'Inactive', 'On Hold', 'Churned'];
const COUNTRIES = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Australia', 'Japan', 'Brazil', 'India', 'Netherlands'];
const TITLES = ['CEO', 'CTO', 'VP Sales', 'Marketing Director', 'Engineering Manager', 'Product Manager', 'Sales Rep', 'Account Executive'];

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

function generateMockRows(fields: RDField[], count = 25): Record<string, any>[] {
  return Array.from({ length: count }, (_, i) => {
    const row: Record<string, any> = { _id: i + 1 };
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    fields.forEach((f) => {
      const fullName = `${fn} ${ln}`;
      switch (f.fieldName) {
        case 'full_name': row[f.fieldName] = fullName; break;
        case 'first_name': row[f.fieldName] = fn; break;
        case 'last_name': row[f.fieldName] = ln; break;
        case 'name': row[f.fieldName] = f.tableId === 'deals' ? `${pick(COMPANIES)} Deal` : pick(COMPANIES); break;
        case 'email': row[f.fieldName] = `${fn.toLowerCase()}.${ln.toLowerCase()}@${pick(['example.com', 'company.org', 'business.io', 'mail.co'])}`; break;
        case 'phone': row[f.fieldName] = `+1 (${rand(200, 999)}) ${rand(100, 999)}-${rand(1000, 9999)}`; break;
        case 'title': row[f.fieldName] = pick(TITLES); break;
        case 'company': row[f.fieldName] = pick(COMPANIES); break;
        case 'amount': row[f.fieldName] = rand(1000, 250000); break;
        case 'annual_revenue': row[f.fieldName] = rand(50000, 50000000); break;
        case 'stage': row[f.fieldName] = pick(STAGES); break;
        case 'status': row[f.fieldName] = f.tableId === 'accounts' ? pick(ACCT_STATUSES) : pick(STATUSES); break;
        case 'source': row[f.fieldName] = pick(SOURCES); break;
        case 'industry': row[f.fieldName] = pick(INDUSTRIES); break;
        case 'pipeline': row[f.fieldName] = pick(PIPELINES); break;
        case 'country': row[f.fieldName] = pick(COUNTRIES); break;
        case 'contact_name': row[f.fieldName] = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; break;
        case 'type': row[f.fieldName] = pick(['Customer', 'Prospect', 'Partner', 'Vendor']); break;
        case 'owner': row[f.fieldName] = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; break;
        case 'created_at': {
          const d = new Date(2023, 0, 1);
          d.setDate(d.getDate() + rand(0, 900));
          row[f.fieldName] = d.toISOString().split('T')[0];
          break;
        }
        case 'close_date': {
          const d = new Date(2024, 0, 1);
          d.setDate(d.getDate() + rand(0, 500));
          row[f.fieldName] = d.toISOString().split('T')[0];
          break;
        }
        case 'score': row[f.fieldName] = rand(10, 100); break;
        case 'probability': row[f.fieldName] = rand(10, 100); break;
        case 'employees': row[f.fieldName] = rand(10, 50000); break;
        default: row[f.fieldName] = `Value ${i + 1}`;
      }
    });
    return row;
  });
}

function getMockRowsForReport(state: RDState): Record<string, any>[] {
  const allFields = new Set<RDField>();
  state.columns.forEach(z => allFields.add(z.field));
  state.rows.forEach(z => allFields.add(z.field));
  state.values.forEach(z => allFields.add(z.field));
  state.filters.forEach(f => allFields.add(f.field));
  if (allFields.size === 0) return [];
  return generateMockRows(Array.from(allFields), 30);
}

function evaluateFormula(expression: string, row: Record<string, any>, fields: RDField[]): any {
  let expr = expression;
  fields.forEach(f => {
    expr = expr.replace(new RegExp(`\\{${f.tableId}\\.${f.fieldName}\\}`, 'g'), String(row[f.fieldName] ?? 0));
    expr = expr.replace(new RegExp(`\\{${f.fieldName}\\}`, 'g'), String(row[f.fieldName] ?? 0));
  });
  if (/^[0-9+\-*/().%\s]+$/.test(expr)) {
    try {
      const result = Function('"use strict"; return (' + expr + ')')();
      return isNaN(result) ? expr : result;
    } catch { return expr; }
  }
  return expr;
}

/* ───────────────────────────────────────────────
   Reducer
   ─────────────────────────────────────────────── */

type RDAction =
  | { type: 'NEW_REPORT' }
  | { type: 'LOAD_REPORT'; id: string }
  | { type: 'DELETE_REPORT'; id: string }
  | { type: 'SET_VIEW_MODE'; mode: 'tabular' | 'pivot' }
  | { type: 'ADD_TO_ZONE'; zone: 'columns' | 'rows' | 'values'; field: RDField }
  | { type: 'REMOVE_FROM_ZONE'; zone: 'columns' | 'rows' | 'values'; instanceId: string }
  | { type: 'MOVE_IN_ZONE'; zone: 'columns' | 'rows' | 'values'; from: number; to: number }
  | { type: 'SET_AGGREGATION'; zone: 'values'; instanceId: string; aggregation: Aggregation }
  | { type: 'SET_SORT'; zone: 'columns' | 'rows'; instanceId: string; sort: SortDir }
  | { type: 'ADD_FILTER' }
  | { type: 'UPDATE_FILTER'; instanceId: string; field?: RDField; operator?: ReportFilter['operator']; value?: string; value2?: string }
  | { type: 'REMOVE_FILTER'; instanceId: string }
  | { type: 'OPEN_FORMULA_EDITOR'; id?: string }
  | { type: 'CLOSE_FORMULA_EDITOR' }
  | { type: 'SAVE_FORMULA'; formula: ReportFormula }
  | { type: 'DELETE_FORMULA'; id: string }
  | { type: 'SAVE_REPORT' }
  | { type: 'SET_REPORT_NAME'; name: string }
  | { type: 'DUPLICATE_REPORT' };

const EMPTY_RD_STATE: RDState = {
  reports: [],
  activeReportId: null,
  viewMode: 'tabular',
  columns: [],
  rows: [],
  values: [],
  filters: [],
  formulas: [],
  showFormulaEditor: false,
  editingFormulaId: null,
};

function createDefaultReport(): SavedReport {
  return {
    id: uid(),
    name: 'New Report',
    dataSource: 'leads',
    viewMode: 'tabular',
    columns: [],
    rows: [],
    values: [],
    filters: [],
    formulas: [],
  };
}

function buildReportFromState(state: RDState, id: string, name: string): SavedReport {
  return { id, name, dataSource: 'leads', viewMode: state.viewMode, columns: [...state.columns], rows: [...state.rows], values: [...state.values], filters: [...state.filters], formulas: [...state.formulas] };
}

function rdReducer(state: RDState, action: RDAction): RDState {
  switch (action.type) {
    case 'NEW_REPORT': {
      const rpt = createDefaultReport();
      return { ...EMPTY_RD_STATE, reports: [...state.reports, rpt], activeReportId: rpt.id, columns: rpt.columns, rows: rpt.rows, values: rpt.values, filters: rpt.filters, formulas: rpt.formulas, viewMode: rpt.viewMode };
    }
    case 'LOAD_REPORT': {
      const rpt = state.reports.find(r => r.id === action.id);
      if (!rpt) return state;
      return { ...state, activeReportId: rpt.id, viewMode: rpt.viewMode, columns: [...rpt.columns], rows: [...rpt.rows], values: [...rpt.values], filters: [...rpt.filters], formulas: [...rpt.formulas] };
    }
    case 'DELETE_REPORT':
      return { ...state, reports: state.reports.filter(r => r.id !== action.id), activeReportId: state.activeReportId === action.id ? null : state.activeReportId };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode, rows: action.mode === 'tabular' ? [] : state.rows, values: action.mode === 'tabular' ? [] : state.values };
    case 'ADD_TO_ZONE': {
      const exists = (state as any)[action.zone].some((z: ZoneField) => z.field.tableId === action.field.tableId && z.field.fieldName === action.field.fieldName);
      if (exists) return state;
      const newItem: ZoneField = { instanceId: uid(), field: action.field, aggregation: 'sum', sort: 'none' };
      return { ...state, [action.zone]: [...(state as any)[action.zone], newItem] };
    }
    case 'REMOVE_FROM_ZONE': {
      const zone = action.zone as 'columns' | 'rows' | 'values';
      return { ...state, [zone]: (state as any)[zone].filter((z: ZoneField) => z.instanceId !== action.instanceId) };
    }
    case 'MOVE_IN_ZONE': {
      const arr = [...(state as any)[action.zone]] as ZoneField[];
      const [item] = arr.splice(action.from, 1);
      arr.splice(action.to, 0, item);
      return { ...state, [action.zone]: arr };
    }
    case 'SET_AGGREGATION':
      return { ...state, values: state.values.map(z => z.instanceId === action.instanceId ? { ...z, aggregation: action.aggregation } : z) };
    case 'SET_SORT':
      return { ...state, [action.zone]: (state as any)[action.zone].map((z: ZoneField) => z.instanceId === action.instanceId ? { ...z, sort: action.sort } : z) };
    case 'ADD_FILTER':
      return { ...state, filters: [...state.filters, { instanceId: uid(), field: MOCK_TABLES[0].fields[0], operator: 'equals', value: '', value2: '' }] };
    case 'UPDATE_FILTER':
      return { ...state, filters: state.filters.map(f => f.instanceId === action.instanceId ? { ...f, ...(action.field !== undefined ? { field: action.field } : {}), ...(action.operator !== undefined ? { operator: action.operator } : {}), ...(action.value !== undefined ? { value: action.value } : {}), ...(action.value2 !== undefined ? { value2: action.value2 } : {}) } : f) };
    case 'REMOVE_FILTER':
      return { ...state, filters: state.filters.filter(f => f.instanceId !== action.instanceId) };
    case 'OPEN_FORMULA_EDITOR':
      return { ...state, showFormulaEditor: true, editingFormulaId: action.id || null };
    case 'CLOSE_FORMULA_EDITOR':
      return { ...state, showFormulaEditor: false, editingFormulaId: null };
    case 'SAVE_FORMULA':
      if (state.editingFormulaId) {
        return { ...state, formulas: state.formulas.map(f => f.id === state.editingFormulaId ? action.formula : f), showFormulaEditor: false, editingFormulaId: null };
      }
      return { ...state, formulas: [...state.formulas, action.formula], showFormulaEditor: false, editingFormulaId: null };
    case 'DELETE_FORMULA':
      return { ...state, formulas: state.formulas.filter(f => f.id !== action.id) };
    case 'SAVE_REPORT': {
      if (!state.activeReportId) return state;
      const idx = state.reports.findIndex(r => r.id === state.activeReportId);
      const name = state.reports.find(r => r.id === state.activeReportId)?.name || 'Untitled Report';
      const updated = buildReportFromState(state, state.activeReportId, name);
      const reports = [...state.reports];
      reports[idx] = updated;
      return { ...state, reports };
    }
    case 'SET_REPORT_NAME': {
      if (!state.activeReportId) return state;
      return { ...state, reports: state.reports.map(r => r.id === state.activeReportId ? { ...r, name: action.name } : r) };
    }
    case 'DUPLICATE_REPORT': {
      if (!state.activeReportId) return state;
      const rpt = state.reports.find(r => r.id === state.activeReportId);
      if (!rpt) return state;
      const dup: SavedReport = { ...rpt, id: uid(), name: `${rpt.name} (Copy)` };
      return { ...state, reports: [...state.reports, dup], activeReportId: dup.id, columns: [...rpt.columns], rows: [...rpt.rows], values: [...rpt.values], filters: [...rpt.filters], formulas: [...rpt.formulas] };
    }
    default:
      return state;
  }
}

/* ───────────────────────────────────────────────
   Formatting helpers
   ─────────────────────────────────────────────── */

function formatCellValue(value: any, type: string): string {
  if (value == null) return '—';
  switch (type) {
    case 'currency': {
      const n = Number(value);
      return isNaN(n) ? String(value) : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case 'number': {
      const n = Number(value);
      return isNaN(n) ? String(value) : n.toLocaleString('en-US');
    }
    case 'percent': {
      const n = Number(value);
      return isNaN(n) ? String(value) : n + '%';
    }
    case 'date': return String(value);
    default: return String(value);
  }
}

/* ───────────────────────────────────────────────
   Pivot Engine
   ─────────────────────────────────────────────── */

interface PivotResult {
  rowHeaders: string[][];
  colHeaders: string[];
  cells: (string | number)[][];
  rowFieldLabels: string[];
  rowFieldNames: string[];
  colFieldName: string;
  valueFieldNames: string[];
  valueFieldLabels: string[];
  aggregations: Aggregation[];
}

function buildPivot(rows: Record<string, any>[], rowFields: ZoneField[], colField: ZoneField | null, valueFields: ZoneField[]): PivotResult {
  if (rowFields.length === 0 || valueFields.length === 0) {
    return { rowHeaders: [], colHeaders: [], cells: [], rowFieldLabels: [], rowFieldNames: [], colFieldName: '', valueFieldNames: [], valueFieldLabels: [], aggregations: [] };
  }

  const rowFieldNames = rowFields.map(z => z.field.fieldName);
  const rowFieldLabels = rowFields.map(z => z.field.label);
  const colFieldName = colField?.field.fieldName || '';
  const valueFieldNames = valueFields.map(z => z.field.fieldName);
  const valueFieldLabels = valueFields.map(z => z.field.label);
  const aggregations = valueFields.map(z => z.aggregation);

  const groups = new Map<string, Record<string, any>[]>();
  rows.forEach(row => {
    const rowKey = rowFieldNames.map(fn => String(row[fn] ?? '')).join('||');
    if (!groups.has(rowKey)) groups.set(rowKey, []);
    groups.get(rowKey)!.push(row);
  });

  const rowHeaders: string[][] = [];
  if (colField) {
    const colValues = [...new Set(rows.map(r => String(r[colFieldName] ?? '')))].sort();
    if (colValues.length === 0) colValues.push('');
    const cells: (string | number)[][] = [];
    groups.forEach((groupRows, rowKey) => {
      const header = rowKey.split('||');
      rowHeaders.push(header);
      const row: (string | number)[] = [];
      const colGroups = new Map<string, Record<string, any>[]>();
      groupRows.forEach(r => {
        const cv = String(r[colFieldName] ?? '');
        if (!colGroups.has(cv)) colGroups.set(cv, []);
        colGroups.get(cv)!.push(r);
      });
      colValues.forEach(cv => {
        const cr = colGroups.get(cv) || [];
        valueFields.forEach((vf, vi) => {
          row.push(aggregateValue(cr, vf.field.fieldName, vf.aggregation));
        });
      });
      // totals
      valueFields.forEach((vf, vi) => {
        row.push(aggregateValue(groupRows, vf.field.fieldName, vf.aggregation));
      });
      cells.push(row);
    });

    const colHeaders: string[] = [];
    colValues.forEach(cv => {
      valueFieldLabels.forEach(vfl => colHeaders.push(`${cv} ${vfl}`));
    });
    valueFieldLabels.forEach(vfl => colHeaders.push(`Total ${vfl}`));

    return { rowHeaders, colHeaders, cells, rowFieldLabels, rowFieldNames, colFieldName, valueFieldNames, valueFieldLabels, aggregations };
  }

  // No column field — simple grouped rows with value columns
  const cells: (string | number)[][] = [];
  groups.forEach((groupRows, rowKey) => {
    rowHeaders.push(rowKey.split('||'));
    const row: (string | number)[] = valueFields.map(vf => aggregateValue(groupRows, vf.field.fieldName, vf.aggregation));
    cells.push(row);
  });

  return { rowHeaders, colHeaders: valueFieldLabels, cells, rowFieldLabels, rowFieldNames, colFieldName: '', valueFieldNames, valueFieldLabels, aggregations };
}

function aggregateValue(rows: Record<string, any>[], fieldName: string, agg: Aggregation): number {
  const values = rows.map(r => Number(r[fieldName])).filter(v => !isNaN(v));
  if (values.length === 0) return 0;
  switch (agg) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return rows.length;
    default: return rows.length;
  }
}

/* ───────────────────────────────────────────────
   Icon for field type
   ─────────────────────────────────────────────── */

function fieldTypeIcon(type: string) {
  switch (type) {
    case 'number': case 'percent': case 'currency': return <Hash size={12} />;
    case 'date': return <Calendar size={12} />;
    case 'text': case 'email': case 'phone': return <Type size={12} />;
    case 'select': return <AlignLeft size={12} />;
    default: return <Type size={12} />;
  }
}

function fieldTypeColor(type: string): string {
  switch (type) {
    case 'number': case 'percent': case 'currency': return 'var(--sails-info)';
    case 'date': return 'var(--sails-warning)';
    case 'select': return 'var(--sails-success)';
    default: return 'var(--sails-primary)';
  }
}

/* ───────────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────────── */

const FieldPalette: React.FC<{
  tables: RDTable[];
  formulas: ReportFormula[];
  onFieldDragStart: (e: React.DragEvent, field: RDField) => void;
  onFormulaDragStart: (e: React.DragEvent, formula: ReportFormula) => void;
  onAddFormula: () => void;
  onEditFormula: (id: string) => void;
  onDeleteFormula: (id: string) => void;
}> = ({ tables, formulas, onFieldDragStart, onFormulaDragStart, onAddFormula, onEditFormula, onDeleteFormula }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const tableIcon = (icon: string) => {
    switch (icon) {
      case 'UserPlus': return <UserPlus size={14} />;
      case 'Briefcase': return <Briefcase size={14} />;
      case 'Users': return <Users size={14} />;
      case 'Building2': return <Building2 size={14} />;
      default: return <Database size={14} />;
    }
  };

  return (
    <aside className="sails-rd__palette">
      <div className="sails-rd__palette-header">
        <Database size={16} />
        <span>Data Fields</span>
      </div>
      {tables.map(table => (
        <div key={table.id} className="sails-rd__palette-section">
          <button className="sails-rd__palette-section-header" onClick={() => toggle(table.id)}>
            {collapsed.has(table.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {tableIcon(table.icon)}
            <span>{table.name}</span>
            <span className="sails-rd__palette-count">{table.fields.length}</span>
          </button>
          {!collapsed.has(table.id) && (
            <div className="sails-rd__palette-section-body">
              {table.fields.map(field => (
                <div
                  key={`${field.tableId}.${field.fieldName}`}
                  className="sails-rd__field-item"
                  draggable
                  onDragStart={(e) => onFieldDragStart(e, field)}
                >
                  <span className="sails-rd__field-item-icon" style={{ color: fieldTypeColor(field.type) }}>
                    {fieldTypeIcon(field.type)}
                  </span>
                  <span className="sails-rd__field-item-label">{field.label}</span>
                  <span className="sails-rd__field-item-type">{field.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="sails-rd__palette-section sails-rd__palette-section--formulas">
        <div className="sails-rd__palette-section-header sails-rd__palette-section-header--formulas">
          <Sigma size={14} />
          <span>Formulas</span>
          <button className="sails-rd__add-formula-btn" onClick={onAddFormula} title="Add Formula">
            <Plus size={14} />
          </button>
        </div>
        {formulas.length === 0 ? (
          <div className="sails-rd__palette-empty">No formulas yet</div>
        ) : (
          <div className="sails-rd__palette-section-body">
            {formulas.map(fm => (
              <div
                key={fm.id}
                className="sails-rd__field-item sails-rd__field-item--formula"
                draggable
                onDragStart={(e) => onFormulaDragStart(e, fm)}
                onDoubleClick={() => onEditFormula(fm.id)}
              >
                <span className="sails-rd__field-item-icon" style={{ color: 'var(--sails-primary)' }}>
                  <Sigma size={12} />
                </span>
                <span className="sails-rd__field-item-label">{fm.name}</span>
                <button
                  className="sails-rd__field-item-delete"
                  onClick={(e) => { e.stopPropagation(); onDeleteFormula(fm.id); }}
                  title="Delete formula"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

const DropZone: React.FC<{
  label: string;
  icon: React.ReactNode;
  zone: 'columns' | 'rows' | 'values';
  items: ZoneField[];
  isPivot: boolean;
  onDrop: (zone: 'columns' | 'rows' | 'values', e: React.DragEvent) => void;
  onRemove: (zone: 'columns' | 'rows' | 'values', instanceId: string) => void;
  onSetAggregation: (instanceId: string, agg: Aggregation) => void;
  onSetSort: (instanceId: string, sort: SortDir) => void;
  onMoveItem: (zone: 'columns' | 'rows' | 'values', from: number, to: number) => void;
}> = ({ label, icon, zone, items, isPivot, onDrop, onRemove, onSetAggregation, onSetSort, onMoveItem }) => {
  const [dragOver, setDragOver] = useState(false);
  const [dragItemIdx, setDragItemIdx] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onDrop(zone, e);
  };

  const handleItemDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'reorder', zone, index: idx }));
    setDragItemIdx(idx);
  };

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragItemIdx(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'reorder' && data.zone === zone && data.index !== targetIdx) {
        onMoveItem(zone, data.index, targetIdx);
        return;
      }
    } catch { /* not a reorder */ }
    onDrop(zone, e);
  };

  return (
    <div
      className={`sails-rd__dropzone ${dragOver ? 'sails-rd__dropzone--active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sails-rd__dropzone-header">
        <span className="sails-rd__dropzone-icon">{icon}</span>
        <span className="sails-rd__dropzone-label">{label}</span>
        <span className="sails-rd__dropzone-count">{items.length}</span>
      </div>
      <div className="sails-rd__dropzone-body">
        {items.length === 0 ? (
          <div className="sails-rd__dropzone-placeholder">Drop fields here</div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.instanceId}
              className={`sails-rd__field-chip ${dragItemIdx === idx ? 'sails-rd__field-chip--dragging' : ''}`}
              draggable
              onDragStart={(e) => handleItemDragStart(e, idx)}
              onDragOver={handleItemDragOver}
              onDrop={(e) => handleItemDrop(e, idx)}
              onDragEnd={() => setDragItemIdx(null)}
            >
              <span className="sails-rd__field-chip-grip"><GripVertical size={12} /></span>
              <span className="sails-rd__field-chip-icon" style={{ color: fieldTypeColor(item.field.type) }}>
                {fieldTypeIcon(item.field.type)}
              </span>
              <span className="sails-rd__field-chip-label">
                <span className="sails-rd__field-chip-table">{item.field.tableName}.</span>
                {item.field.label}
              </span>
              {zone === 'values' && isPivot && (
                <select
                  className="sails-rd__field-chip-agg"
                  value={item.aggregation}
                  onChange={(e) => onSetAggregation(item.instanceId, e.target.value as Aggregation)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="sum">SUM</option>
                  <option value="avg">AVG</option>
                  <option value="count">COUNT</option>
                  <option value="min">MIN</option>
                  <option value="max">MAX</option>
                </select>
              )}
              {zone !== 'values' && (
                <button
                  className={`sails-rd__field-chip-sort ${item.sort !== 'none' ? 'sails-rd__field-chip-sort--active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next: SortDir = item.sort === 'none' ? 'asc' : item.sort === 'asc' ? 'desc' : 'none';
                    onSetSort(item.instanceId, next);
                  }}
                  title={item.sort === 'none' ? 'Sort ascending' : item.sort === 'asc' ? 'Sort descending' : 'Remove sort'}
                >
                  {item.sort === 'asc' ? '↑' : item.sort === 'desc' ? '↓' : '↕'}
                </button>
              )}
              <button
                className="sails-rd__field-chip-remove"
                onClick={() => onRemove(zone, item.instanceId)}
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const FilterRow: React.FC<{
  filter: ReportFilter;
  allFields: RDField[];
  onUpdate: (instanceId: string, field?: RDField, operator?: ReportFilter['operator'], value?: string, value2?: string) => void;
  onRemove: (instanceId: string) => void;
}> = ({ filter, allFields, onUpdate, onRemove }) => {
  return (
    <div className="sails-rd__filter-row">
      <select
        className="sails-rd__filter-field"
        value={`${filter.field.tableId}.${filter.field.fieldName}`}
        onChange={(e) => {
          const [tid, fn] = e.target.value.split('.');
          const f = allFields.find(x => x.tableId === tid && x.fieldName === fn);
          if (f) onUpdate(filter.instanceId, f, undefined, undefined, undefined);
        }}
      >
        <option value="">Select field...</option>
        {MOCK_TABLES.map(t => (
          <optgroup key={t.id} label={t.name}>
            {t.fields.map(f => (
              <option key={`${f.tableId}.${f.fieldName}`} value={`${f.tableId}.${f.fieldName}`}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        className="sails-rd__filter-operator"
        value={filter.operator}
        onChange={(e) => onUpdate(filter.instanceId, undefined, e.target.value as ReportFilter['operator'], undefined, undefined)}
      >
        <option value="equals">=</option>
        <option value="not_equals">≠</option>
        <option value="contains">contains</option>
        <option value="greater_than">&gt;</option>
        <option value="less_than">&lt;</option>
        <option value="between">between</option>
        <option value="is_empty">is empty</option>
        <option value="is_not_empty">is not empty</option>
      </select>
      {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
        <>
          <input
            type="text"
            className="sails-rd__filter-value"
            placeholder="Value"
            value={filter.value}
            onChange={(e) => onUpdate(filter.instanceId, undefined, undefined, e.target.value, undefined)}
          />
          {filter.operator === 'between' && (
            <input
              type="text"
              className="sails-rd__filter-value"
              placeholder="Value 2"
              value={filter.value2}
              onChange={(e) => onUpdate(filter.instanceId, undefined, undefined, undefined, e.target.value)}
            />
          )}
        </>
      )}
      <button className="sails-rd__filter-remove" onClick={() => onRemove(filter.instanceId)} title="Remove filter">
        <X size={14} />
      </button>
    </div>
  );
};

const FiltersPanel: React.FC<{
  filters: ReportFilter[];
  allFields: RDField[];
  onAdd: () => void;
  onUpdate: (instanceId: string, field?: RDField, operator?: ReportFilter['operator'], value?: string, value2?: string) => void;
  onRemove: (instanceId: string) => void;
}> = ({ filters, allFields, onAdd, onUpdate, onRemove }) => {
  return (
    <div className="sails-rd__dropzone sails-rd__filters-panel">
      <div className="sails-rd__dropzone-header">
        <span className="sails-rd__dropzone-icon"><Filter size={14} /></span>
        <span className="sails-rd__dropzone-label">Filters</span>
        <button className="sails-rd__filter-add-btn" onClick={onAdd} title="Add filter">
          <Plus size={14} />
        </button>
      </div>
      <div className="sails-rd__dropzone-body sails-rd__filters-body">
        {filters.length === 0 ? (
          <div className="sails-rd__dropzone-placeholder">
            No filters applied — all records included
          </div>
        ) : (
          filters.map(f => (
            <FilterRow key={f.instanceId} filter={f} allFields={allFields} onUpdate={onUpdate} onRemove={onRemove} />
          ))
        )}
      </div>
    </div>
  );
};

const FormulaEditorModal: React.FC<{
  formula: ReportFormula | null;
  tables: RDTable[];
  onSave: (formula: ReportFormula) => void;
  onClose: () => void;
}> = ({ formula, tables, onSave, onClose }) => {
  const [name, setName] = useState(formula?.name || '');
  const [expression, setExpression] = useState(formula?.expression || '');
  const [returnType, setReturnType] = useState<ReportFormula['returnType']>(formula?.returnType || 'number');
  const [preview, setPreview] = useState('');
  const allFields = useMemo(() => tables.flatMap(t => t.fields), [tables]);

  const handleInsertField = (field: RDField) => {
    setExpression(prev => prev + `{${field.tableId}.${field.fieldName}}`);
  };

  const handleInsertFn = (fn: string) => {
    setExpression(prev => prev + fn);
  };

  useEffect(() => {
    if (!expression) { setPreview(''); return; }
    const row: Record<string, any> = {};
    allFields.forEach(f => { row[f.fieldName] = f.type === 'number' || f.type === 'currency' || f.type === 'percent' ? 100 : f.type === 'date' ? '2024-01-15' : 'Sample'; });
    setPreview(String(evaluateFormula(expression, row, allFields)));
  }, [expression, allFields]);

  const handleSave = () => {
    if (!name.trim() || !expression.trim()) return;
    onSave({
      id: formula?.id || uid(),
      name: name.trim(),
      expression: expression.trim(),
      returnType,
    });
  };

  return (
    <div className="sails-modal-overlay" onClick={onClose}>
      <div className="sails-modal sails-rd__formula-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{formula ? 'Edit Formula' : 'New Formula'}</h2>

        <div className="sails-form-group">
          <label>Formula Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Commission Amount" />
        </div>

        <div className="sails-form-group">
          <label>Return Type</label>
          <select value={returnType} onChange={(e) => setReturnType(e.target.value as ReportFormula['returnType'])}>
            <option value="number">Number</option>
            <option value="text">Text</option>
            <option value="currency">Currency</option>
            <option value="date">Date</option>
          </select>
        </div>

        <div className="sails-form-group">
          <label>Expression</label>
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder='e.g. {deals.amount} * 0.1 + 500'
            rows={3}
          />
          {preview && (
            <div className="sails-rd__formula-preview">
              <span className="sails-rd__formula-preview-label">Preview:</span>
              <code>{preview}</code>
            </div>
          )}
        </div>

        <div className="sails-rd__formula-helpers">
          <div className="sails-rd__formula-helpers-title">Insert Field</div>
          <div className="sails-rd__formula-helpers-grid">
            {tables.flatMap(t => t.fields.map(f => (
              <button key={`${t.id}.${f.fieldName}`} className="sails-rd__formula-helper-btn" onClick={() => handleInsertField(f)}>
                {t.name}.{f.label}
              </button>
            )))}
          </div>
        </div>

        <div className="sails-rd__formula-helpers">
          <div className="sails-rd__formula-helpers-title">Insert Function</div>
          <div className="sails-rd__formula-helpers-grid sails-rd__formula-helpers-grid--fn">
            {['SUM(', 'AVG(', 'COUNT(', 'IF(', 'ROUND(', 'CONCAT(', 'ABS(', 'MIN(', 'MAX('].map(fn => (
              <button key={fn} className="sails-rd__formula-helper-btn sails-rd__formula-helper-btn--fn" onClick={() => handleInsertFn(fn)}>
                {fn}
              </button>
            ))}
          </div>
        </div>

        <div className="sails-modal__footer">
          <button className="sails-btn sails-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="sails-btn sails-btn--primary" onClick={handleSave} disabled={!name.trim() || !expression.trim()}>
            {formula ? 'Update' : 'Create Formula'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TabularPreview: React.FC<{
  columns: ZoneField[];
  formulas: ReportFormula[];
  filters: ReportFilter[];
  allFields: RDField[];
}> = ({ columns, formulas, filters, allFields }) => {
  const fields: RDField[] = useMemo(() => {
    const f = columns.map(c => c.field);
    formulas.forEach(fm => f.push({ tableId: '__formula__', tableName: 'Formula', fieldName: fm.id, label: fm.name, type: fm.returnType === 'currency' ? 'currency' : fm.returnType === 'date' ? 'date' : fm.returnType === 'number' ? 'number' : 'text' }));
    return f;
  }, [columns, formulas]);

  const rows = useMemo(() => {
    if (fields.length === 0) return [];
    return generateMockRows(fields, 20);
  }, [fields]);

  if (columns.length === 0 && formulas.length === 0) {
    return (
      <div className="sails-rd__preview-empty">
        <LayoutList size={48} strokeWidth={1} />
        <h3>No columns selected</h3>
        <p>Drag fields from the palette into the Columns zone to build your report.</p>
      </div>
    );
  }

  return (
    <div className="sails-rd__preview-table-wrapper">
      <table className="sails-rd__preview-table">
        <thead>
          <tr>
            <th className="sails-rd__preview-row-num">#</th>
            {columns.map(c => (
              <th key={c.instanceId}>
                {c.field.label}
                {c.sort !== 'none' && <span className="sails-rd__sort-indicator">{c.sort === 'asc' ? ' ↑' : ' ↓'}</span>}
              </th>
            ))}
            {formulas.map(fm => (
              <th key={fm.id} className="sails-rd__preview-formula-col">
                <Sigma size={12} /> {fm.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="sails-rd__preview-row-num">{ri + 1}</td>
              {columns.map(c => (
                <td key={c.instanceId}>{formatCellValue(row[c.field.fieldName], c.field.type)}</td>
              ))}
              {formulas.map(fm => (
                <td key={fm.id}>{formatCellValue(evaluateFormula(fm.expression, row, allFields), fm.returnType)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PivotPreview: React.FC<{
  rows: ZoneField[];
  columns: ZoneField[];
  values: ZoneField[];
  formulas: ReportFormula[];
  allFields: RDField[];
}> = ({ rows, columns, values, formulas, allFields }) => {
  const colField = columns.length > 0 ? columns[0] : null;
  const rowFields = rows;
  const valueFields = values.length > 0 ? values : (columns.length > 0 ? [columns[0]] : []);

  const dataFields: RDField[] = useMemo(() => {
    const f: RDField[] = [];
    rowFields.forEach(r => f.push(r.field));
    if (colField) f.push(colField.field);
    valueFields.forEach(v => f.push(v.field));
    return f;
  }, [rowFields, colField, valueFields]);

  const mockRows = useMemo(() => {
    if (dataFields.length === 0) return [];
    return generateMockRows(dataFields, 60);
  }, [dataFields]);

  const pivot = useMemo(() => buildPivot(mockRows, rowFields, colField, valueFields), [mockRows, rowFields, colField, valueFields]);

  if (rowFields.length === 0 || valueFields.length === 0) {
    return (
      <div className="sails-rd__preview-empty">
        <LayoutGrid size={48} strokeWidth={1} />
        <h3>Pivot configuration needed</h3>
        <p>Add fields to Rows and Values zones to generate a pivot table.</p>
      </div>
    );
  }

  return (
    <div className="sails-rd__preview-table-wrapper">
      <table className="sails-rd__preview-table sails-rd__preview-table--pivot">
        <thead>
          <tr>
            {pivot.rowFieldLabels.map((l, i) => <th key={i}>{l}</th>)}
            {pivot.colHeaders.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {pivot.cells.map((row, ri) => (
            <tr key={ri}>
              {pivot.rowHeaders[ri].map((h, hi) => <td key={hi} className={`sails-rd__pivot-row-header sails-rd__pivot-row-header--${hi}`}>{h}</td>)}
              {row.map((cell, ci) => (
                <td key={ci}>{typeof cell === 'number' ? formatCellValue(cell, valueFields[ci % valueFields.length]?.field.type || 'number') : cell}</td>
              ))}
            </tr>
          ))}
          {pivot.cells.length === 0 && (
            <tr><td colSpan={pivot.rowFieldLabels.length + pivot.colHeaders.length} className="sails-rd__preview-empty-cell">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

/* ───────────────────────────────────────────────
   Report Toolbar
   ─────────────────────────────────────────────── */

const ReportToolbar: React.FC<{
  activeReport: SavedReport | undefined;
  viewMode: 'tabular' | 'pivot';
  reports: SavedReport[];
  onViewModeChange: (mode: 'tabular' | 'pivot') => void;
  onNewReport: () => void;
  onSaveReport: () => void;
  onLoadReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onDuplicateReport: () => void;
  onSetName: (name: string) => void;
}> = ({ activeReport, viewMode, reports, onViewModeChange, onNewReport, onSaveReport, onLoadReport, onDeleteReport, onDuplicateReport, onSetName }) => {
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  return (
    <div className="sails-rd__toolbar">
      <div className="sails-rd__toolbar-left">
        <select
          className="sails-rd__reports-select"
          value={activeReport?.id || ''}
          onChange={(e) => {
            if (e.target.value === '__new__') { onNewReport(); return; }
            if (e.target.value) onLoadReport(e.target.value);
          }}
        >
          {reports.length === 0 && <option value="">No saved reports</option>}
          {reports.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
          <option value="__new__" className="sails-rd__reports-select-new">+ New Report</option>
        </select>
        {activeReport && (
          editingName ? (
            <input
              ref={nameInputRef}
              className="sails-rd__report-name-input"
              value={activeReport.name}
              onChange={(e) => onSetName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
            />
          ) : (
            <span className="sails-rd__report-name" onClick={() => setEditingName(true)} title="Click to rename">
              {activeReport.name}
            </span>
          )
        )}
      </div>

      <div className="sails-rd__toolbar-center">
        <div className="sails-rd__view-toggle">
          <button
            className={`sails-rd__view-toggle-btn ${viewMode === 'tabular' ? 'sails-rd__view-toggle-btn--active' : ''}`}
            onClick={() => onViewModeChange('tabular')}
          >
            <Table2 size={14} /> Tabular
          </button>
          <button
            className={`sails-rd__view-toggle-btn ${viewMode === 'pivot' ? 'sails-rd__view-toggle-btn--active' : ''}`}
            onClick={() => onViewModeChange('pivot')}
          >
            <LayoutGrid size={14} /> Pivot
          </button>
        </div>
      </div>

      <div className="sails-rd__toolbar-right">
        {activeReport && (
          <>
            <button className="sails-btn sails-btn--ghost" onClick={onDuplicateReport} title="Duplicate">
              <Copy size={14} /> <span>Duplicate</span>
            </button>
            <button className="sails-btn sails-btn--ghost" onClick={() => onDeleteReport(activeReport.id)} title="Delete">
              <Trash2 size={14} /> <span>Delete</span>
            </button>
            <button className="sails-btn sails-btn--secondary" onClick={onSaveReport} title="Save">
              <Save size={14} /> <span>Save</span>
            </button>
          </>
        )}
        <button className="sails-btn sails-btn--primary" onClick={onNewReport}>
          <Plus size={14} /> <span>New Report</span>
        </button>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────
   Main Report Designer
   ─────────────────────────────────────────────── */

const ReportDesigner: React.FC = () => {
  const { setHeaderActions, setPageTitle, setPageSubtitle } = useConsole();
  const [state, dispatch] = useReducer(rdReducer, EMPTY_RD_STATE, () => {
    const defaultReport: SavedReport = {
      id: uid(), name: 'Sales Pipeline Overview', dataSource: 'deals', viewMode: 'tabular',
      columns: [
        { instanceId: uid(), field: MOCK_TABLES[1].fields[0], aggregation: 'sum', sort: 'none' },
        { instanceId: uid(), field: MOCK_TABLES[1].fields[1], aggregation: 'sum', sort: 'none' },
        { instanceId: uid(), field: MOCK_TABLES[1].fields[2], aggregation: 'sum', sort: 'none' },
      ],
      rows: [], values: [],
      filters: [{ instanceId: uid(), field: MOCK_TABLES[1].fields[2], operator: 'not_equals', value: 'Closed Lost', value2: '' }],
      formulas: [],
    };
    return { ...EMPTY_RD_STATE, reports: [defaultReport], activeReportId: defaultReport.id, columns: [...defaultReport.columns], filters: [...defaultReport.filters] };
  });

  const activeReport = state.reports.find(r => r.id === state.activeReportId);
  const allFields = useMemo(() => MOCK_TABLES.flatMap(t => t.fields), []);
  const editingFormula = state.editingFormulaId ? state.formulas.find(f => f.id === state.editingFormulaId) || null : null;

  useEffect(() => {
    setPageTitle('Report Designer');
    setPageSubtitle('Build custom tabular and pivot reports with formulas');
    return () => { setPageTitle(null); setPageSubtitle(null); };
  }, [setPageTitle, setPageSubtitle]);

  useEffect(() => {
    setHeaderActions(null);
    return () => { setHeaderActions(null); };
  }, [setHeaderActions]);

  const handleFieldDragStart = useCallback((e: React.DragEvent, field: RDField) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'field', field }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleFormulaDragStart = useCallback((e: React.DragEvent, formula: ReportFormula) => {
    const field: RDField = { tableId: '__formula__', tableName: 'Formula', fieldName: formula.id, label: formula.name, type: formula.returnType === 'currency' ? 'currency' : formula.returnType === 'date' ? 'date' : formula.returnType === 'number' ? 'number' : 'text' };
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'field', field }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleZoneDrop = useCallback((zone: 'columns' | 'rows' | 'values', e: React.DragEvent) => {
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'field' && data.field) {
        dispatch({ type: 'ADD_TO_ZONE', zone, field: data.field });
      }
    } catch { /* ignore */ }
  }, []);

  const handleMoveItem = useCallback((zone: 'columns' | 'rows' | 'values', from: number, to: number) => {
    dispatch({ type: 'MOVE_IN_ZONE', zone, from, to });
  }, []);

  return (
    <div className="sails-rd">
      <ReportToolbar
        activeReport={activeReport}
        viewMode={state.viewMode}
        reports={state.reports}
        onViewModeChange={(mode) => dispatch({ type: 'SET_VIEW_MODE', mode })}
        onNewReport={() => dispatch({ type: 'NEW_REPORT' })}
        onSaveReport={() => dispatch({ type: 'SAVE_REPORT' })}
        onLoadReport={(id) => dispatch({ type: 'LOAD_REPORT', id })}
        onDeleteReport={(id) => dispatch({ type: 'DELETE_REPORT', id })}
        onDuplicateReport={() => dispatch({ type: 'DUPLICATE_REPORT' })}
        onSetName={(name) => dispatch({ type: 'SET_REPORT_NAME', name })}
      />

      <div className="sails-rd__builder">
        <FieldPalette
          tables={MOCK_TABLES}
          formulas={state.formulas}
          onFieldDragStart={handleFieldDragStart}
          onFormulaDragStart={handleFormulaDragStart}
          onAddFormula={() => dispatch({ type: 'OPEN_FORMULA_EDITOR' })}
          onEditFormula={(id) => dispatch({ type: 'OPEN_FORMULA_EDITOR', id })}
          onDeleteFormula={(id) => dispatch({ type: 'DELETE_FORMULA', id })}
        />

        <div className="sails-rd__workspace">
          <FiltersPanel
            filters={state.filters}
            allFields={allFields}
            onAdd={() => dispatch({ type: 'ADD_FILTER' })}
            onUpdate={(id, f, op, v, v2) => dispatch({ type: 'UPDATE_FILTER', instanceId: id, field: f, operator: op, value: v, value2: v2 })}
            onRemove={(id) => dispatch({ type: 'REMOVE_FILTER', instanceId: id })}
          />

          {state.viewMode === 'tabular' ? (
            <DropZone
              label="Columns" icon={<Table2 size={14} />} zone="columns"
              items={state.columns} isPivot={false}
              onDrop={handleZoneDrop}
              onRemove={(z, id) => dispatch({ type: 'REMOVE_FROM_ZONE', zone: z, instanceId: id })}
              onSetAggregation={(id, agg) => dispatch({ type: 'SET_AGGREGATION', zone: 'values', instanceId: id, aggregation: agg })}
              onSetSort={(id, sort) => dispatch({ type: 'SET_SORT', zone: 'columns', instanceId: id, sort })}
              onMoveItem={handleMoveItem}
            />
          ) : (
            <>
              <DropZone
                label="Rows" icon={<AlignLeft size={14} />} zone="rows"
                items={state.rows} isPivot
                onDrop={handleZoneDrop}
                onRemove={(z, id) => dispatch({ type: 'REMOVE_FROM_ZONE', zone: z, instanceId: id })}
                onSetAggregation={() => {}}
                onSetSort={(id, sort) => dispatch({ type: 'SET_SORT', zone: 'rows', instanceId: id, sort })}
                onMoveItem={handleMoveItem}
              />
              <div className="sails-rd__dropzones-row">
                <DropZone
                  label="Columns" icon={<Table2 size={14} />} zone="columns"
                  items={state.columns} isPivot
                  onDrop={handleZoneDrop}
                  onRemove={(z, id) => dispatch({ type: 'REMOVE_FROM_ZONE', zone: z, instanceId: id })}
                  onSetAggregation={() => {}}
                  onSetSort={(id, sort) => dispatch({ type: 'SET_SORT', zone: 'columns', instanceId: id, sort })}
                  onMoveItem={handleMoveItem}
                />
                <DropZone
                  label="Values" icon={<Hash size={14} />} zone="values"
                  items={state.values} isPivot
                  onDrop={handleZoneDrop}
                  onRemove={(z, id) => dispatch({ type: 'REMOVE_FROM_ZONE', zone: z, instanceId: id })}
                  onSetAggregation={(id, agg) => dispatch({ type: 'SET_AGGREGATION', zone: 'values', instanceId: id, aggregation: agg })}
                  onSetSort={() => {}}
                  onMoveItem={handleMoveItem}
                />
              </div>
            </>
          )}

          <div className="sails-rd__preview sails-card">
            <div className="sails-rd__preview-header">
              <h3 className="sails-rd__preview-title">
                {state.viewMode === 'tabular' ? <Table2 size={16} /> : <LayoutGrid size={16} />}
                {activeReport?.name || 'Untitled'} — Preview
              </h3>
              <span className="sails-rd__preview-count">
                {state.viewMode === 'tabular'
                  ? `${state.columns.length + state.formulas.length} columns`
                  : `${state.rows.length} rows × ${state.columns.length} cols × ${state.values.length} values`}
              </span>
            </div>

            {state.viewMode === 'tabular' ? (
              <TabularPreview
                columns={state.columns}
                formulas={state.formulas}
                filters={state.filters}
                allFields={allFields}
              />
            ) : (
              <PivotPreview
                rows={state.rows}
                columns={state.columns}
                values={state.values}
                formulas={state.formulas}
                allFields={allFields}
              />
            )}
          </div>
        </div>
      </div>

      {state.showFormulaEditor && (
        <FormulaEditorModal
          formula={editingFormula}
          tables={MOCK_TABLES}
          onSave={(formula) => dispatch({ type: 'SAVE_FORMULA', formula })}
          onClose={() => dispatch({ type: 'CLOSE_FORMULA_EDITOR' })}
        />
      )}
    </div>
  );
};

export default ReportDesigner;
