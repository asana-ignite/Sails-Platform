/**
 * DynamicDetailPage — the runtime record DETAIL/FORM page: loads the
 * active layout, renders its sections/tabs/blocks, supports create/edit
 * with validation, and shows Expression fields evaluated LIVE while typing.
 */
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Table2,
  Save,
  Loader2,
  Pencil,
  Copy,
  Trash2,
  List,
  Zap
} from 'lucide-react';
import type { TableLayout, SailsFieldDefinition, ConsoleMenu, DetailAction, FormVariable, LayoutValidationRule } from '@sails/shared';
import { isSystemField, SYSTEM_PROTECTED_COLUMNS, registerExpressionFunctions } from '@sails/shared';
import jsonata from 'jsonata';
import LoadingScreen from '../components/common/LoadingScreen';
import RelatedListView from '../components/common/RelatedListView';
import { fetchCached } from '../api/client';
import { DetailFieldInput, DetailFieldDisplay, DetailFieldLabel, validateFieldIssues } from '../features/controls/DetailFieldControl';
import DynamicIcon from '../components/common/DynamicIcon';
import type { FieldValidation } from '../features/controls/types';
import { evaluateExpressionFields } from '../utils/expressionLive';
import { resolveActiveRules, deriveConditionSets, conditionEvalContext, type ConditionSetsDerived } from '../utils/conditionSets';
import { evaluateFilterGroups } from '@sails/shared';
import { useLocalizedText } from '../lib/useLocalizedText';
import { NotificationMessageModal } from '../components/common/NotificationMessageModal';
import '../components/common/NotificationMessageModal.css';
import { useConsole } from '../contexts/ConsoleContext';
import { useRecordStack } from '../contexts/RecordStackContext';
import { useToast } from '../contexts/ToastContext';
import { ActionRegistry } from '../features/actions';
import { UiConfirmDialog } from '../components/ui/UiConfirmDialog';
import SailsPopover from '../components/common/SailsPopover';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

// ── Route Helper ──────────────────────────────────────────────
interface DetailRouteParams {
  appSlug: string;
  dataModelId: string | null;
  layoutKey: string | null;
  recordId: string | null;
  isNewMode: boolean;
}

/**
 * Resolves the current URL against the nav menu tree.
 * URL shape: /{appSlug}/{navPath}/{layoutKey}/{recordId}
 * e.g. /test/testtype/test_type_details_view/<recordId> or .../new
 */
const getDetailRouteParams = (pathname: string, menus: ConsoleMenu[]): DetailRouteParams => {
  const parts = pathname.split('/').filter(Boolean);
  const appSlug = parts[0] || 'admin';
  const normalize = (p: string | null) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

  const allMenus: ConsoleMenu[] = [];
  const collect = (items: ConsoleMenu[]) => {
    for (const m of items) {
      allMenus.push(m);
      if (m.children) collect(m.children);
    }
  };
  collect(menus);

  const target = normalize(pathname);
  const matched = allMenus
    .filter(m => { const p = normalize(m.path); return !!p && target.startsWith(p + '/'); })
    .sort((a, b) => normalize(b.path).length - normalize(a.path).length)[0];

  if (!matched) {
    return { appSlug, dataModelId: null, layoutKey: null, recordId: null, isNewMode: false };
  }

  const rest = target.slice(normalize(matched.path).length).split('/').filter(Boolean);
  const layoutKey = rest[0] || null;
  const recordId = rest[1] || null;
  return {
    appSlug,
    dataModelId: matched.dataModelId || null,
    layoutKey,
    recordId,
    isNewMode: recordId === 'new',
  };
};

// ── Sub-Component: Page Header ────────────────────────────────
interface DetailHeaderProps {
  primaryTitle: string;
  isNewMode: boolean;
  isEditing: boolean;
  saving: boolean;
  canEdit: boolean;
  allowEdit?: boolean;
  headerActions?: React.ReactNode;
  onBack: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  showBack?: boolean;
}

const DetailHeader: React.FC<DetailHeaderProps> = memo(
  ({ primaryTitle, isNewMode, isEditing, saving, canEdit, allowEdit = true, headerActions, onBack, onEdit, onCancelEdit, onSave, showBack = true }) => (
    <header className="sails-page-header sails-dynamic-table__header">
      <div className="sails-page-header__left" style={{ pointerEvents: 'auto' }}>
        {showBack && (
          <button
            type="button"
            className="sails-btn sails-btn--secondary"
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, marginRight: 12 }}
            title="Back"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div>
          <h1 className="sails-page-header__title">{primaryTitle}</h1>
        </div>
      </div>
      {isNewMode || isEditing ? (
        <div className="sails-page-header__right" style={{ pointerEvents: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sails-btn sails-btn--secondary"
            onClick={isNewMode ? onBack : onCancelEdit}
            disabled={saving}
          >
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="sails-btn sails-btn--primary"
            disabled={saving}
            onClick={onSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="sails-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isNewMode ? 'Save Record' : 'Update Record'}</span>
              </>
            )}
          </button>
        </div>
      ) : canEdit ? (
        <div className="sails-page-header__right" style={{ pointerEvents: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {headerActions}
          {allowEdit && (
            <button
              type="button"
              className="sails-btn sails-btn--primary"
              onClick={onEdit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Pencil size={16} />
              <span>Edit</span>
            </button>
          )}
        </div>
      ) : null}
    </header>
  )
);

// ── Main Page Component ────────────────────────────────────────
interface DynamicDetailPageProps {
  /** When provided, override route-derived params (stacked card / generic route). */
  tableName?: string;
  layoutKey?: string;
  recordId?: string;
  isNewMode?: boolean;
  /** Pre-filled values for a new record (e.g. parent FK binding from a Related List block). */
  presetValues?: Record<string, any>;
  /** Render as a compact card shell (stacked record panel) instead of a full page. */
  inStack?: boolean;
}

const DynamicDetailPage: React.FC<DynamicDetailPageProps> = ({
  tableName: tableNameProp,
  layoutKey: layoutKeyProp,
  recordId: recordIdProp,
  isNewMode: isNewModeProp,
  presetValues,
  inStack = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { navigationItems, apps } = useConsole();
  const auth = useAuth();
  const { requestClose, notifyRecordsChanged } = useRecordStack();
  const { toast } = useToast();
  const animClass = navigationType === 'POP' ? 'sails-dynamic-table--back' : '';

  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [fields, setFields] = useState<SailsFieldDefinition[]>([]);
  const [record, setRecord] = useState<any | null>(null);
  const [formVars, setFormVars] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeTabMap, setActiveTabMap] = useState<Record<string, number>>({});
  const [collapsedSectionMap, setCollapsedSectionMap] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveAttempted, setSaveAttempted] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // ── Detail action buttons (Events tab config) ──
  const [pendingConfirmAction, setPendingConfirmAction] = useState<DetailAction | null>(null);
  const [cloneDraft, setCloneDraft] = useState<{
    action: DetailAction;
    children: { tableName: string; label: string }[];
    selected: Set<string>;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; openId?: string } | null>(null);
  /** Paused Notification Message modal — set while a chain waits for a choice. */
  const [pendingMessageBox, setPendingMessageBox] = useState<{
    box: any;
    resumeEventId: string;
    body: Record<string, any>;
    resumeVariables: Record<string, any>;
  } | null>(null);
  const [messageBoxBusy, setMessageBoxBusy] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLButtonElement>(null);

  const { dataModelId, layoutKey, recordId, isNewMode } = useMemo(() => {
    // 1. Explicit props (stacked record card) override everything else.
    if (tableNameProp) {
      return {
        dataModelId: tableNameProp,
        layoutKey: layoutKeyProp || null,
        recordId: recordIdProp || null,
        // A stacked "new" card opens the create form (not an existing record).
        isNewMode: isNewModeProp || recordIdProp === 'new',
      };
    }
    // 2. Generic record route: /_r/:tableName/:layoutKey/:recordId (menu-independent).
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === '_r') {
      return {
        dataModelId: parts[1] || null,
        layoutKey: parts[2] || null,
        recordId: parts[3] || null,
        isNewMode: parts[3] === 'new',
      };
    }
    // 3. Menu-bound route (default).
    const menus = navigationItems.length > 0 ? navigationItems : (apps || []).flatMap(a => a.menus || []);
    return getDetailRouteParams(location.pathname, menus);
  }, [tableNameProp, layoutKeyProp, recordIdProp, isNewModeProp, location.pathname, navigationItems, apps]);

  // Base nav route without the layout/record segments.
  const baseRoute = useMemo(() => {
    if (tableNameProp) return `/_r/${tableNameProp}`;
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === '_r') return `/_r/${parts[1] || ''}`;
    return '/' + parts.slice(0, Math.max(1, parts.length - 2)).join('/');
  }, [location.pathname, tableNameProp]);

  // ── Guard: only reload/reset when the record target actually changes ──
  const recordTargetKey = `${dataModelId}|${layoutKey}|${recordId}|${isNewMode}`;
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedKeyRef.current === recordTargetKey) return; // same record — skip reload/reset
    loadedKeyRef.current = recordTargetKey;

    if (!dataModelId || !recordId) {
      setError('Invalid record detail route parameter');
      setLoading(false);
      return;
    }

    const loadDetailData = async () => {
      setLoading(true);
      setError(null);
      setSaveError(null);
      setIsEditing(false);
      setFormData({});
      setTouched({});
      setSaveAttempted(false);

      try {
        // Fetch the table's layouts once; resolve the layout from the URL segment
        // (matches layout system_name or id, e.g. /test/testtype/test_type_details_view/<id>)
        const lResult = await fetchCached(`/api/console/layouts?tableId=${dataModelId}&page=1&limit=100`);
        const rows: any[] = lResult?.data?.rows || lResult?.rows || [];

        const detailRows = rows.filter((r: any) => r.viewType === 'DETAIL' || r.viewType === 'FORM');
        let targetLayout: any = null;

        if (layoutKey) {
          targetLayout = detailRows.find((r: any) => r.systemName === layoutKey || r.id === layoutKey) || null;
        }
        if (!targetLayout) {
          targetLayout =
            detailRows.find((r: any) => r.status === 'active' && r.isDefault) ||
            detailRows.find((r: any) => r.status === 'active') ||
            detailRows[0] ||
            null;
        }

        const resolvedTableName = targetLayout?.table?.tableName || null;

        if (isNewMode) {
          let tableFields: SailsFieldDefinition[] = [];
          if (resolvedTableName) {
            const schemaRes = await fetch(`/api/dynamic/${resolvedTableName}?page=1&pageSize=1`);
            if (schemaRes.ok) {
              const schemaData = await schemaRes.json();
              tableFields = schemaData.fields || [];
            }
          }

          setFields(tableFields);
          setLayout(targetLayout || null);
          setTableName(resolvedTableName);
          setRecord({});

          const initialForm: Record<string, any> = {};
          tableFields.forEach((f) => {
            const key = f.fieldName || f.id;
            if (isSystemField(key)) return;
            // Auto-number is generated by the DB on insert — leave it out of the
            // payload so the column DEFAULT fires (and edit never re-runs it).
            if ((f.logicalType || '').toLowerCase() === 'auto_number') return;
            // Expression (calculated) values are always generated server-side.
            if ((f.logicalType || '').toLowerCase() === 'expression') return;
            initialForm[key] = f.defaultValue !== undefined && f.defaultValue !== null
              ? f.defaultValue
              : '';
          });
          // Pre-filled values (e.g. parent FK binding from a Related List block)
          // win over defaults; hidden fields are still submitted on save.
          if (presetValues && typeof presetValues === 'object') {
            for (const [key, val] of Object.entries(presetValues)) {
              if (isSystemField(key)) continue;
              if (val === undefined || val === null || val === '') continue;
              initialForm[key] = val;
            }
          }
          setFormData(initialForm);
          setLoading(false);
          return;
        }

        if (!resolvedTableName) {
          setError('Data model table reference not found');
          setLoading(false);
          return;
        }

        setTableName(resolvedTableName);
        const recordsRes = await fetch(`/api/dynamic/${resolvedTableName}?id=${recordId}`);

        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          const rowsArr = recordsData.rows || (Array.isArray(recordsData) ? recordsData : []);
          setRecord(rowsArr[0] || null);
          setFields(recordsData.fields || []);
        } else {
          setError('Failed to load record details');
        }

        setLayout(targetLayout || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load record details');
      } finally {
        setLoading(false);
      }
    };

    loadDetailData();
  }, [location.pathname, dataModelId, layoutKey, recordId, isNewMode, presetValues]);

  const L = useLocalizedText();

  const config = useMemo(() => {
    if (!layout) return null;
    let raw = layout.status === 'active' ? (layout.publishedConfig || layout.config) : layout.config;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (e) {}
    }
    return raw;
  }, [layout]);

  // ── Form variables: initialize defaults when the record loads ──
  useEffect(() => {
    const decls: FormVariable[] = (config as any)?.formVariables || [];
    if (decls.length === 0) {
      setFormVars({});
      return;
    }
    if (!record) return;
    const out: Record<string, any> = {};
    for (const v of decls) {
      if (!v?.name) continue;
      let val: any = v.defaultValue;
      if (v.expression?.trim()) {
        try {
          const fn = jsonata(v.expression);
          registerExpressionFunctions(fn);
          const r = fn.evaluate({ ...record, vars: out, variables: out });
          if (r !== undefined) val = r;
        } catch {
          /* keep default */
        }
      }
      out[v.name] = val;
    }
    setFormVars(out);
  }, [record?.id]);

  const [liveExpressionValues, setLiveExpressionValues] = useState<Record<string, any> | null>(null);

  // ── Live record for conditions: form input while editing/creating ──
  const liveConditionRecord = useMemo(() => {
    const base = record || {};
    if (!isEditing && !isNewMode) return base;
    return { ...base, ...formData, ...(liveExpressionValues || {}) };
  }, [record, formData, liveExpressionValues, isEditing, isNewMode]);

  const conditionUser = auth.user ? { id: auth.user.id, role: auth.user.role, email: auth.user.email } : undefined;

  // ── Condition Sets: active rules against the LIVE record + form vars ──
  const [conditionDerived, setConditionDerived] = useState<ConditionSetsDerived>(() => deriveConditionSets([]));
  useEffect(() => {
    let mounted = true;
    resolveActiveRules((config as any)?.conditionSets, conditionEvalContext(liveConditionRecord, formVars, fields, conditionUser))
      .then((rules) => { if (mounted) setConditionDerived(deriveConditionSets(rules)); })
      .catch(() => undefined);
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, liveConditionRecord, formVars, fields]);

  // ── Validation tab rules: active (conditions match the live record) ──
  const [activeValidationRules, setActiveValidationRules] = useState<LayoutValidationRule[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const rules: LayoutValidationRule[] = (config as any)?.validations || [];
      const ctx = conditionEvalContext(liveConditionRecord, formVars, fields, conditionUser);
      const out: LayoutValidationRule[] = [];
      for (const r of rules) {
        if (await evaluateFilterGroups(r.conditionGroups, ctx)) out.push(r);
      }
      if (mounted) setActiveValidationRules(out);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, liveConditionRecord, formVars, fields]);

  /** Bar-location rules (aggregated into the error bar). */
  const barValidationRules = useMemo(
    () => activeValidationRules.filter((r) => r.errorLocation === 'bar'),
    [activeValidationRules],
  );

  /** In-Field failing rules keyed by target fieldId. */
  const failingInFieldByField = useMemo(() => {
    const map: Record<string, LayoutValidationRule[]> = {};
    for (const r of activeValidationRules) {
      if (r.errorLocation === 'bar') continue;
      for (const fid of r.targetFieldIds || []) {
        const list = map[fid] || (map[fid] = []);
        list.push(r);
      }
    }
    return map;
  }, [activeValidationRules]);

  // Field → block validation rules (sections + tabs), keyed by fieldId (legacy block rules only).
  const blockRulesByField = useMemo(() => {
    const map: Record<string, FieldValidation[]> = {};
    const collect = (list: any[]) => {
      for (const b of list || []) {
        if (b?.validations?.length && b.fieldId) {
          map[b.fieldId] = [...(map[b.fieldId] || []), ...b.validations];
        }
        if (b?.blockType === 'tab_group') {
          for (const t of b.tabs || []) collect(t.blocks);
        }
      }
    };
    collect((config as any)?.blocks || []);
    return map;
  }, [config]);

  // ── Live error bar: bar-location failures for touched fields (or all on save) ──
  const liveBarFailures = useMemo(() => {
    const out: string[] = [];
    for (const r of barValidationRules) {
      if (r.errorMessage) out.push(r.errorMessage);
    }
    return out;
  }, [barValidationRules]);

  // Blocks whose model field no longer exists are dropped up front (the server
  // prunes layouts on field delete; this covers layouts saved before that fix)
  // so a deleted field never leaves blank space in the form grid.
  const blocks: any[] = useMemo(() => {
    const resolveField = (fieldId?: string) =>
      !!fieldId && fields.some((f) => f.id === fieldId || f.fieldName === fieldId);

    const clean = (list: any[]): any[] =>
      (list || []).flatMap((b) => {
        if (!b) return [];
        if (b.blockType === 'field' && !resolveField(b.fieldId)) return [];
        if (b.blockType === 'tab_group') {
          return [{ ...b, tabs: (b.tabs || []).map((t: any) => ({ ...t, blocks: clean(t.blocks || []) })) }];
        }
        return [b];
      });

    return clean((config as any)?.blocks || []).filter((b: any) =>
      b.blockType === 'tab_group' ? true : !conditionDerived.stateOf(b.id).hidden
    );
  }, [config, fields, conditionDerived]);

  const handleFieldInputChange = (key: string, value: any) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Live Expression preview ──────────────────────────────────
  // Re-evaluate computed fields on every keystroke so formulas update in real
  // time while editing/creating (no save needed). Read-only mode evaluates
  // against the stored record (harmless; keeps the value fresh).
  useEffect(() => {
    let cancelled = false;
    const hasExpressions = (fields || []).some(
      (f) => (f.logicalType || '').toLowerCase() === 'expression',
    );
    if (!hasExpressions) {
      setLiveExpressionValues(null);
      return;
    }
    const source = isNewMode || isEditing ? formData : record;
    if (!source || typeof source !== 'object') {
      setLiveExpressionValues(null);
      return;
    }
    evaluateExpressionFields(fields, source).then((result) => {
      if (!cancelled) setLiveExpressionValues(result.values);
    });
    return () => { cancelled = true; };
  }, [fields, formData, record, isNewMode, isEditing]);

  const handleEditRecord = () => {
    if (!record) return;
    setActionsMenuOpen(false);
    const initialForm: Record<string, any> = {};
    for (const field of fields) {
      const key = field.fieldName || field.id;
      if (!key || isSystemField(key)) continue;
      initialForm[key] = record[key] ?? record[field.id] ?? '';
    }
    setFormData(initialForm);
    setTouched({});
    setSaveAttempted(false);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setActionsMenuOpen(false);
    setIsEditing(false);
    setFormData({});
    setTouched({});
    setSaveAttempted(false);
    setSaveError(null);
  };

  const handleSaveRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tableName) return;

    // Client-side validation gate: metadata config rules + layout block rules.
    const issues: string[] = [];
    for (const field of fields) {
      const key = field.fieldName || field.id;
      if (!key || isSystemField(key)) continue;
      issues.push(...validateFieldIssues(field, formData[key], blockRulesByField[field.id], formData));
    }
    // Validation-tab rules gate the save — a matched condition = failing.
    for (const r of activeValidationRules) {
      if (r.errorMessage) issues.push(r.errorMessage);
    }
    if (issues.length > 0) {
      setSaveAttempted(true);
      const first = issues[0];
      const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
      setSaveError(`Please fix the highlighted fields: ${first}${more}`);
      return;
    }

    const isUpdate = !isNewMode && isEditing;
    setSaving(true);
    setSaveError(null);

    try {
      const payload = isUpdate
        ? Object.fromEntries(Object.entries(formData).filter(([k]) => !SYSTEM_PROTECTED_COLUMNS.includes(k)))
        : formData;

      const res = await fetch(
        isUpdate ? `/api/dynamic/${tableName}?id=${recordId}` : `/api/dynamic/${tableName}`,
        {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error || data.success === false) {
        throw new Error(data.error || data.message || 'Failed to save record.');
      }

      if (isUpdate) {
        const updatedRecord = data.record || data.data || (Array.isArray(data.rows) ? data.rows[0] : data.rows) || data;
        setRecord(updatedRecord || {});
        setIsEditing(false);
        setFormData({});
        setTouched({});
        setSaveAttempted(false);
        toast.success('Record updated successfully.');
      } else {
        const createdRecord = data.record || (Array.isArray(data.rows) ? data.rows[0] : data.rows) || data.data || data;
        const newId = createdRecord?.id || data.id;
        toast.success('Record created successfully.');

        if (inStack) {
          // Stacked create: close the "new" card fully (no created-record card) and
          // tell lists/related blocks underneath to refetch so the record appears.
          requestClose();
          notifyRecordsChanged();
          return;
        }

        navigate(newId ? `${baseRoute}/${layoutKey}/${newId}` : baseRoute, {
          replace: true,
        });
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save record.');
      toast.error(err.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  // ── Detail action execution ──
  const configuredDetailActions = useMemo(() => {
    if (!config) return [];
    const list = (config as any).detailActions;
    return Array.isArray(list) ? (list as DetailAction[]).filter((a) => a.visible !== false) : [];
  }, [config]);

  const runDetailAction = (action: DetailAction) => {
    if (actionBusy) return;
    setActionError(null);
    setActionMessage(null);
    const plugin = ActionRegistry.getInstance().getAction(action.actionKey);
    if (action.actionKey === 'clone') {
      openCloneDraft(action);
      return;
    }
    if (action.requireConfirm || plugin?.confirm) {
      setPendingConfirmAction(action);
      return;
    }
    void executeDetailAction(action);
  };

  const openCloneDraft = async (action: DetailAction) => {
    setActionBusy(true);
    try {
      const data = await fetchCached('/api/metadata/objects', undefined, 60000);
      const tables: any[] = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      const tn = tableName || '';
      const children = tables
        .filter((t) =>
          (t.fields || []).some(
            (f: any) => String(f.config?.targetTable || '') === tn
          )
        )
        .map((t) => ({ tableName: t.tableName, label: t.name || t.tableName }));
      const related = (config as any)?.relatedRecords || [];
      const prechecked = new Set<string>();
      for (const r of related) {
        const hit = children.find((c) => c.tableName === r.tableName);
        if (hit) prechecked.add(hit.tableName);
      }
      setCloneDraft({ action, children, selected: prechecked });
    } catch {
      // fall back to shallow clone if metadata is unavailable
      void executeDetailAction(action, []);
      return;
    } finally {
      setActionBusy(false);
    }
  };

  /**
   * Adopt a successful form-event chain response: merge the variable
   * accumulator into page-level form variables, write exposeToForm values
   * into the form, and apply Record Event formOutputMapping onto controls.
   * Shared by the normal run and the Notification Message resume.
   */
  const adoptChainResponse = (data: any, sections: any[]) => {
    if (!data) return;
    if (data.variables && typeof data.variables === 'object') {
      setFormVars((prev) => ({ ...prev, ...data.variables }));
    }

    // Variables declared with exposeToForm write into the form controls
    // (before Record Event mappings apply).
    const exposed: Record<string, any> = data.exposedVariables || {};
    if (Object.keys(exposed).length > 0) {
      setFormData((prev: Record<string, any>) => ({ ...prev, ...exposed }));
      setRecord((prev: any) => (prev ? { ...prev, ...exposed } : prev));
    }

    // Apply Record Event results onto the layout's form controls
    // (config.formOutputMapping: result field → form field).
    const vars: Record<string, any> = data.variables || {};
    for (const sec of sections || []) {
      for (const ev of sec.events || []) {
        const fm: { sourceField: string; targetFieldId: string }[] = (ev.config as any)?.formOutputMapping || [];
        if (fm.length === 0 || !ev.storeAs) continue;
        const rec = vars[ev.storeAs];
        if (rec == null || typeof rec !== 'object') continue;
        const patch: Record<string, any> = {};
        for (const m of fm) {
          const f = fields.find((ff) => ff.id === m.targetFieldId || ff.fieldName === m.targetFieldId);
          if (!f) continue;
          const v = m.sourceField.split('.').reduce<any>((acc, seg) => (acc == null ? undefined : acc[seg]), rec);
          if (v !== undefined) patch[f.fieldName] = v;
        }
        if (Object.keys(patch).length > 0) {
          setFormData((prev: Record<string, any>) => ({ ...prev, ...patch }));
          setRecord((prev: any) => (prev ? { ...prev, ...patch } : prev));
        }
      }
    }
  };

  /**
   * Resume a paused Notification Message chain with the user's choice.
   * confirm/ok → the server continues the events below the message;
   * cancel → the server stops the chain (nothing below runs).
   */
  const resumeMessageBox = async (choice: 'confirm' | 'cancel' | 'ok') => {
    if (!pendingMessageBox || !tableName) return;
    setMessageBoxBusy(true);
    try {
      const body = {
        ...pendingMessageBox.body,
        resume: { eventId: pendingMessageBox.resumeEventId, choice },
        resumeVariables: pendingMessageBox.resumeVariables,
      };
      const res = await fetch(`/api/dynamic/${tableName}/form-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Event chain failed.');
      if (choice === 'cancel' || data.cancelled) {
        setActionMessage({ text: 'Action cancelled.' });
      } else {
        adoptChainResponse(data, sections);
      }
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setMessageBoxBusy(false);
      setPendingMessageBox(null);
      setActionBusy(false);
    }
  };

  const executeDetailAction = async (action: DetailAction, include?: string[]) => {
    setActionBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const plugin = ActionRegistry.getInstance().getAction(action.actionKey);
      const ctx: any = {
        tableId: dataModelId || '',
        tableName: tableName || '',
        layoutId: layout?.id,
        menuPath: baseRoute,
        embedded: inStack,
        defaultDetailLayoutKey: layoutKey || undefined,
        navigate,
        refetch: () => undefined,
        notifyRecordsChanged,
        recordId: recordId || undefined,
        record: record || undefined,
        cloneInclude: include,
        onEdit: handleEditRecord,
      };

      if (plugin) {
        await plugin.execute(ctx);
      }

      // Custom events (sections with conditions) run AFTER the fixed step.
      const sections = (action.sections || []).map((s) => ({
        conditionGroups: s.conditionGroups || undefined,
        events: (s.events || []).map((e) => ({
          ...e,
          config: { ...e.config, storeToVariable: e.config?.storeToVariable || e.storeAs || undefined },
        })),
      }));
      const hasSectionEvents = sections.some((s) => (s.events || []).length > 0);
      if (hasSectionEvents && tableName) {
        const body: any = {
          sections,
          variables: (config as any)?.formVariables || [],
          initialVariables: formVars,
        };
        if (action.actionKey === 'delete') {
          body.snapshot = record || undefined; // pre-delete snapshot for notifications
        } else if (action.actionKey === 'clone' && ctx.lastResult?.id) {
          body.recordId = ctx.lastResult.id;
        } else {
          body.recordId = recordId || undefined;
        }
        const res = await fetch(`/api/dynamic/${tableName}/form-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Event chain failed.');

        // Notification Message event → the chain is PAUSED server-side: show
        // the modal and return. The user's choice resumes (confirm/ok →
        // continue the events below; cancel → stop the chain).
        if (data.paused && data.notificationMessage) {
          setPendingMessageBox({
            box: data.notificationMessage,
            resumeEventId: data.resumeEventId,
            body,
            resumeVariables: (data.variables && typeof data.variables === 'object') ? data.variables : {},
          });
          return;
        }

        adoptChainResponse(data, sections);
      }

      if (action.actionKey === 'clone') {
        const newId = ctx.lastResult?.id;
        notifyRecordsChanged();
        toast.success('Record cloned successfully.');
        if (newId && !inStack) {
          setRecord(ctx.lastResult);
          setActionMessage({
            text: 'Record cloned successfully.',
            openId: newId,
          });
        } else if (inStack) {
          setActionMessage({ text: 'Record cloned successfully.' });
        } else {
          setActionMessage({ text: 'Record cloned successfully.' });
        }
      } else if (action.actionKey !== 'delete' && action.actionKey !== 'edit') {
        const actLabel = action.label || 'Action';
        toast.success(`${actLabel} executed successfully.`);
      }
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionBusy(false);
      setPendingConfirmAction(null);
      setCloneDraft(null);
    }
  };

  // Browser tab title: "Sails - <primary column value>" (e.g. "Sails - INV-0001").
  // Uses the layout's configured recordTitleField; skipped for stacked cards so
  // the underlying page keeps its tab title. The ConsoleProvider effect re-runs
  // after navigation and restores the menu/app title.
  useEffect(() => {
    if (inStack) return;
    const titleField = layout?.recordTitleField
      ? fields.find((f) => f.id === layout.recordTitleField)
        || fields.find((f) => f.fieldName === layout.recordTitleField)
        || fields.find((f) => f.name === layout.recordTitleField)
      : null;
    const primaryTitle = isNewMode
      ? `New ${tableName ? tableName.charAt(0).toUpperCase() + tableName.slice(1) : 'Record'}`
      : record
      ? (titleField && record[titleField.fieldName] != null && record[titleField.fieldName] !== ''
          ? record[titleField.fieldName]
          : record.name || record.title || record.label || record.id)
      : null;
    if (primaryTitle) {
      document.title = `Sails - ${primaryTitle}`;
    }
  }, [record, isNewMode, layout, fields, tableName, recordId, inStack]);

  if (loading) {
    return inStack ? (
      <div className="record-detail-card record-detail-card--loading">
        <LoadingScreen />
      </div>
    ) : (
      <LoadingScreen />
    );
  }

  if (error) {
    return (
      <div className={inStack ? 'record-detail-card' : `sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <button className="sails-btn sails-btn--secondary" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, marginRight: 12 }} title="Back">
              <ChevronLeft size={16} />
            </button>
            <AlertCircle size={24} />
            <div>
              <h1 className="sails-page-header__title">Record Detail Error</h1>
              <p className="sails-page-header__subtitle">{error}</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  const titleField = layout?.recordTitleField
    ? fields.find((f) => f.id === layout.recordTitleField)
      || fields.find((f) => f.fieldName === layout.recordTitleField)
      || fields.find((f) => f.name === layout.recordTitleField)
    : null;
  const primaryTitle = isNewMode
    ? `New ${tableName ? tableName.charAt(0).toUpperCase() + tableName.slice(1) : 'Record'}`
    : record
    ? (titleField && record[titleField.fieldName] != null && record[titleField.fieldName] !== ''
        ? record[titleField.fieldName]
        : record.name || record.title || record.label || record.id)
    : `Record #${recordId}`;

  const userVisibleFields = fields.filter((f) => !isSystemField(f.fieldName || f.id));
  const sections: any[] = (config as any)?.sections?.length > 0 ? (config as any).sections : [{ id: 'default_sec', title: 'Record Properties', columns: 2 }];

  const renderBlock = (b: any) => {
    if (!b || b.visible === false) return null;
    const condState = conditionDerived.stateOf(b.id);
    const condStyle = conditionDerived.stylesOf(b.id);
    if (condState.hidden) return null;

    if (b.blockType === 'field' || (!b.blockType && b.fieldId)) {
      const field = fields.find((f) => f.id === b.fieldId || f.fieldName === b.fieldId);
      if (!field) return null;

      const label = b.labelOverride || field.name;
      const key = field.fieldName || field.id;

      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 4) : 4;
      const isSystemFieldDef = !!field.isSystem || isSystemField(key);
      const isEditable = (isNewMode || isEditing) && !isSystemFieldDef && !condState.readOnly;
      const isExpression = (field.logicalType || '').toLowerCase() === 'expression';
      // Expression (computed) fields display the LIVE evaluated value while
      // typing (updates on every keystroke, no save needed); read-only mode
      // falls back to the stored value.
      const val = isExpression
        ? liveExpressionValues && field.fieldName in liveExpressionValues
          ? liveExpressionValues[field.fieldName]
          : (isEditable ? undefined : record ? record[field.fieldName] ?? record[field.id] : undefined)
        : isEditable ? formData[key] ?? '' : record ? record[field.fieldName] ?? record[field.id] : undefined;

      const fieldRules = (b.validations || []) as FieldValidation[];
      return (
        <div
          key={b.id || field.id}
          className="ls-block ls-block--field"
          style={{
            gridColumn: `span ${colSpan}`,
            ...(condStyle ? {
              color: condStyle.textColor,
              background: condStyle.background,
              fontWeight: condStyle.bold ? 600 : undefined,
            } : {}),
          }}
        >
          <DetailFieldLabel field={field} label={label} />
          {condStyle?.icon && (
            <span className="ls-block__cond-icon" style={{ color: condStyle.textColor || undefined }}>
              <DynamicIcon name={condStyle.icon} size={13} />
            </span>
          )}
          {isSystemFieldDef ? (
            <div className="ls-block__value">
              <DetailFieldDisplay field={field} val={val} controlPluginId={b.controlPluginId} />
            </div>
          ) : isEditable ? (
            <DetailFieldInput
              field={field}
              fieldKey={key}
              label={label}
              val={val}
              controlPluginId={b.controlPluginId}
              rules={fieldRules}
              showErrors={!!touched[key] || saveAttempted}
              record={formData}
              onChange={handleFieldInputChange}
            />
          ) : (
            <div className="ls-block__value">
              <DetailFieldDisplay field={field} val={val} controlPluginId={b.controlPluginId} />
            </div>
          )}
          {(!!touched[key] || saveAttempted) && (failingInFieldByField[field.id] || []).length > 0 && (
            <div className="sails-field-error">
              {failingInFieldByField[field.id].map((fr, i) => (
                <div key={i}>{fr.errorMessage || 'Validation failed.'}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (b.blockType === 'spacer') {
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;
      const h = b.height && typeof b.height === 'number' ? Math.min(200, Math.max(8, b.height)) : 32;
      return (
        <div key={b.id} className="ls-block ls-block--spacer" style={{ gridColumn: `span ${colSpan}`, height: h }} />
      );
    }

    if (b.blockType === 'tab_group') {
      const tabs = b.tabs || [];
      const activeTabIdx = activeTabMap[b.id] ?? 0;
      const activeTab = tabs[activeTabIdx];
      const activeBlocks = activeTab?.blocks || [];
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;

      return (
        <div
          key={b.id}
          className="ls-block ls-block--tabs"
          style={{
            gridColumn: `span ${colSpan}`,
            ...(condStyle ? {
              color: condStyle.textColor,
              background: condStyle.background,
              fontWeight: condStyle.bold ? 600 : undefined,
            } : {}),
          }}
        >
          <div className="ls-tabs__bar">
            {tabs.map((tab: any, ti: number) => (
              <div
                key={tab.id || ti}
                className={`ls-tabs__tab ${ti === activeTabIdx ? 'ls-tabs__tab--active' : ''}`}
                onClick={() => setActiveTabMap((prev) => ({ ...prev, [b.id]: ti }))}
              >
                {tab.label}
                {tab.blocks?.length > 0 && <span className="ls-tabs__count">{tab.blocks.length}</span>}
              </div>
            ))}
          </div>
          <div className="ls-tabs__body">
            <div className="ls-section__grid">
              {activeBlocks.length > 0 ? (
                activeBlocks.map((tb: any) => renderBlock(tb))
              ) : (
                <p className="ls-tabs__hint" style={{ gridColumn: '1 / -1' }}>
                  No fields in this tab.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (b.blockType === 'related_list') {
      if (isNewMode) return null;
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;

      // Configured via "Related List View" block (model + FK field + LIST view).
      if (b.relatedTableName && b.relatedFieldName && recordId) {
        return (
          <div
            key={b.id}
            className="ls-block ls-block--related"
            style={{
              gridColumn: `span ${colSpan}`,
              ...(condStyle ? {
                color: condStyle.textColor,
                background: condStyle.background,
                fontWeight: condStyle.bold ? 600 : undefined,
              } : {}),
            }}
          >
            <RelatedListView
              tableName={b.relatedTableName}
              fieldName={b.relatedFieldName}
              viewId={b.relatedViewId}
              parentRecordId={recordId}
              title={b.labelOverride || b.relatedTableLabel || b.relatedTableName}
            />
          </div>
        );
      }

      return (
        <div key={b.id} className="ls-block ls-block--related" style={{ gridColumn: `span ${colSpan}` }}>
          <div className="ls-related__header">
            <Table2 size={14} />
            <span className="ls-related__title">{b.labelOverride || 'Related Records'}</span>
            <span className="ls-related__count">0 records</span>
          </div>
          <div className="ls-related__empty" style={{ padding: 16, textAlign: 'center', color: 'var(--sails-text-muted)', fontSize: '0.85rem' }}>
            Configure a model and list view for this block in Layout Studio.
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={inStack ? 'record-detail-card' : `sails-dynamic-table sails-page-container ${animClass}`}>
      <form
        onKeyDown={(e) => {
          // Enter-to-save: submit on Enter from single-line inputs (the form has
          // no submit button anymore, so no implicit submission can fire).
          if (e.key !== 'Enter' || (e.target as HTMLElement)?.tagName !== 'INPUT') return;
          e.preventDefault();
          handleSaveRecord();
        }}
      >
        <DetailHeader
          primaryTitle={primaryTitle}
          isNewMode={isNewMode}
          isEditing={isEditing}
          saving={saving}
          canEdit={!isNewMode && !!record}
          allowEdit={!configuredDetailActions.some((a) => a.actionKey === 'edit') && (config as any)?.allowEdit === true}
          headerActions={
            !isNewMode && configuredDetailActions.length > 0 ? (
              configuredDetailActions.length > 3 ? (
                <div className="sails-detail-actions-menu">
                  <button
                    ref={actionsMenuRef}
                    type="button"
                    className="sails-btn sails-btn--ghost"
                    disabled={actionBusy}
                    onClick={() => setActionsMenuOpen((o) => !o)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <List size={15} />
                    <span>Actions</span>
                    <ChevronDown size={13} />
                  </button>
                  <SailsPopover
                    open={actionsMenuOpen}
                    triggerRef={actionsMenuRef}
                    onClose={() => setActionsMenuOpen(false)}
                    align="right"
                    className="sails-detail-actions-menu__pop"
                  >
                    <div className="sails-detail-actions-menu__list">
                      {configuredDetailActions.map((a) => {
                        const plugin = ActionRegistry.getInstance().getAction(a.actionKey);
                        const variantClass = a.variant === 'primary' ? 'sails-detail-actions-menu__item--primary'
                          : a.variant === 'danger' ? 'sails-detail-actions-menu__item--danger'
                          : 'sails-detail-actions-menu__item--secondary';
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={`sails-detail-actions-menu__item ${variantClass}`}
                            disabled={actionBusy}
                            title={plugin?.description || a.label}
                            onClick={() => {
                              setActionsMenuOpen(false);
                              runDetailAction(a);
                            }}
                          >
                            <DynamicIcon name={a.iconName || plugin?.iconName || 'Zap'} size={14} />
                            <span>{L(a.label)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </SailsPopover>
                </div>
              ) : (
                <>
                  {configuredDetailActions.map((a) => {
                    const plugin = ActionRegistry.getInstance().getAction(a.actionKey);
                    const variantClass = a.variant === 'primary' ? 'sails-btn--primary'
                      : a.variant === 'danger' ? 'sails-btn--danger'
                      : a.variant === 'ghost' ? 'sails-btn--ghost'
                      : 'sails-btn--secondary';
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`sails-btn ${variantClass}`}
                        disabled={actionBusy}
                        title={plugin?.description || a.label}
                        onClick={() => runDetailAction(a)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <DynamicIcon name={a.iconName || plugin?.iconName || 'Zap'} size={15} />
                        <span>{L(a.label)}</span>
                      </button>
                    );
                  })}
                </>
              )
            ) : undefined
          }
          onBack={inStack ? () => requestClose() : () => navigate(-1)}
          onEdit={handleEditRecord}
          onCancelEdit={handleCancelEdit}
          onSave={() => handleSaveRecord()}
          showBack={!inStack}
        />

        {liveBarFailures.length > 0 && (
          <div className="sails-detail-error-banner" style={{ margin: '0 24px 16px' }}>
            <AlertCircle size={18} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {liveBarFailures.map((m, i) => <span key={i}>{m}</span>)}
            </div>
          </div>
        )}

        <section className="sails-page-body" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {saveError && (
            <div className="sails-detail-error-banner">
              <AlertCircle size={18} />
              <span>{saveError}</span>
            </div>
          )}
          {actionError && (
            <div className="sails-detail-error-banner">
              <AlertCircle size={18} />
              <span>{actionError}</span>
            </div>
          )}
          {actionMessage && (
            <div className="sails-detail-action-toast">
              <span>{actionMessage.text}</span>
              {actionMessage.openId && recordId && (
                <button
                  type="button"
                  className="sails-btn sails-btn--ghost sails-btn--sm"
                  onClick={() => navigate(`${baseRoute}/${layoutKey}/${actionMessage.openId}`)}
                >
                  Open record
                </button>
              )}
            </div>
          )}

          {record ? (
            blocks.length > 0 ? (
              sections.map((section: any) => {
                const sectionBlocks = blocks
                  .filter((b: any) => b.sectionId === section.id && b.visible !== false)
                  .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

                if (sectionBlocks.length === 0) return null;

                const showHeader = section.showHeader !== false;
                const isCollapsible = !!section.collapsible;
                const isCollapsed = collapsedSectionMap[section.id] ?? section.collapsed ?? false;

                const header = showHeader ? (
                  isCollapsible ? (
                    <button
                      type="button"
                      className="sails-detail-section-header-btn"
                      onClick={() => setCollapsedSectionMap((prev) => ({ ...prev, [section.id]: !(prev[section.id] ?? section.collapsed ?? false) }))}
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <span>{L(section.title) || 'Section'}</span>
                    </button>
                  ) : (
                    <h3 className="sails-detail-section-title">{L(section.title) || 'Section'}</h3>
                  )
                ) : null;

                return (
                  <div key={section.id} className="sails-detail-section-card">
                    {header}
                    {!isCollapsed && <div className="ls-section__grid">{sectionBlocks.map((b: any) => renderBlock(b))}</div>}
                  </div>
                );
              })
            ) : (
              <div className="sails-detail-section-card">
                <h3 className="sails-detail-section-title">Record Properties</h3>
                <div className="ls-section__grid">
                  {userVisibleFields.map((f, idx) =>
                    renderBlock({ id: f.id, fieldId: f.id, blockType: 'field', visible: true, width: 4, position: idx })
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="sails-detail-section-card" style={{ textAlign: 'center' }}>
              <p className="ls-empty">Record not found.</p>
            </div>
          )}
        </section>
      </form>

      {/* ── Standard action & Custom action confirm modal ── */}
      {pendingConfirmAction && (() => {
        const plugin = ActionRegistry.getInstance().getAction(pendingConfirmAction.actionKey);
        const confirm = plugin?.confirm;
        const title = pendingConfirmAction.confirmTitle || confirm?.title || `Execute ${pendingConfirmAction.label}?`;
        const body = pendingConfirmAction.confirmMessage || confirm?.message || `Are you sure you want to execute '${pendingConfirmAction.label}'?`;
        const confirmLabel = pendingConfirmAction.confirmLabel || confirm?.confirmLabel || pendingConfirmAction.label || 'Confirm';
        const tone = pendingConfirmAction.confirmTone || confirm?.tone || (pendingConfirmAction.variant === 'danger' ? 'danger' : 'primary');

        return (
          <UiConfirmDialog
            open
            title={title}
            icon={pendingConfirmAction.actionKey === 'delete' ? <Trash2 size={18} /> : <Zap size={18} />}
            body={body}
            confirmLabel={confirmLabel}
            tone={tone}
            loading={actionBusy}
            onConfirm={() => executeDetailAction(pendingConfirmAction)}
            onCancel={() => setPendingConfirmAction(null)}
          />
        );
      })()}

      {/* ── Deep Clone dialog ── */}
      {cloneDraft && (
        <UiConfirmDialog
          open
          title="Deep Clone"
          icon={<Copy size={18} />}
          body={
            <div className="dc-clone-body">
              <p className="dc-clone-hint">Copy this record and its child records?</p>
              {cloneDraft.children.length === 0 && (
                <p className="dc-clone-none">No child models found — the record will be copied as-is.</p>
              )}
              {cloneDraft.children.map((c) => (
                <label key={c.tableName} className="dc-clone-option">
                  <input
                    type="checkbox"
                    checked={cloneDraft.selected.has(c.tableName)}
                    onChange={() => {
                      const next = new Set(cloneDraft.selected);
                      if (next.has(c.tableName)) next.delete(c.tableName);
                      else next.add(c.tableName);
                      setCloneDraft({ ...cloneDraft, selected: next });
                    }}
                  />
                  <span className="dc-clone-label">{c.label}</span>
                  <span className="dc-clone-table">{c.tableName}</span>
                </label>
              ))}
            </div>
          }
          tone="primary"
          confirmLabel="Clone"
          loading={actionBusy}
          onConfirm={() => executeDetailAction(cloneDraft.action, Array.from(cloneDraft.selected))}
          onCancel={() => setCloneDraft(null)}
        />
      )}

      {/* Notification Message (form-event modal): the chain is paused until
          the user confirms/cancels. Cancel stops the events below the box. */}
      {pendingMessageBox && (
        <NotificationMessageModal
          box={pendingMessageBox.box}
          busy={messageBoxBusy}
          onResolve={resumeMessageBox}
          onDismiss={() => { if (!messageBoxBusy) setPendingMessageBox(null); }}
        />
      )}
    </div>
  );
};

export default DynamicDetailPage;
