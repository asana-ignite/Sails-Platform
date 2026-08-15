/**
 * Action Plugin System — Types
 *
 * Mirrors the FieldControlPlugin / FieldControlRegistry pattern.
 * Each action is a self-contained plugin that declares its metadata
 * and carries its execute() handler.
 *
 * Categories:
 *   'list'   — Toolbar action on the List View (always visible, no selection required)
 *   'bulk'   — Bulk action on the List View (only visible when records are selected)
 *   'detail' — Header action on the Detail / Form view
 */

export interface ActionContext {
  /** The object/table this list is bound to */
  tableId: string;
  tableName: string;
  /** The active layout ID */
  layoutId?: string;
  /** The nav menu path for this list, e.g. /test/testtype */
  menuPath?: string;
  /** True when the list is rendered inside a Related List View block (detail
   *  page). Actions that open records should stack the detail panel instead
   *  of navigating the page. */
  embedded?: boolean;
  /** Default detail layout system_name, for building record links */
  defaultDetailLayoutKey?: string;
  /** Selected record IDs (for bulk actions) */
  selectedIds?: string[];
  /** React-Router navigate function */
  navigate: (path: string | number) => void;
  /** Trigger a data refetch on the parent list */
  refetch?: () => void;
  /** Optional: open a drawer/modal by key via ConsoleContext */
  openDrawer?: (key: string, props?: Record<string, any>) => void;
  /** Detail actions: the record being viewed. */
  recordId?: string;
  record?: Record<string, any>;
  /** Detail actions: notify the record stack that the record changed/deleted. */
  notifyRecordsChanged?: () => void;
  /** Deep-clone: child table names to copy along with the parent. */
  cloneInclude?: string[];
  /** Enter edit mode for the current record (Edit action). */
  onEdit?: () => void;
  /** Set by the plugin's execute() — e.g. the newly cloned record. */
  lastResult?: any;
}

/** Themed confirmation shown before an action runs (standard platform modal). */
export interface ActionConfirm {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

export interface ActionPlugin {
  /** Unique machine key, e.g. 'create', 'delete', 'archive' */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description shown in the Layout Studio picker */
  description?: string;
  /** Lucide icon name (e.g. 'Plus', 'Trash2', 'Download') */
  iconName: string;
  /**
   * Which view context this action belongs to:
   *   'list'   — always-visible toolbar on the List page
   *   'bulk'   — only shown when records are selected
   *   'detail' — shown in the Detail/Form view header
   */
  category: 'list' | 'bulk' | 'detail';
  /** True when the action requires at least one selected record */
  requiresSelection: boolean;
  /** Default button variant */
  defaultVariant: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Default label (can be overridden per-layout in Layout Studio) */
  defaultLabel: string;
  /** Show the standard themed confirm modal before executing. */
  confirm?: ActionConfirm;
  /** Placeholder action — shown disabled in pickers (e.g. future features). */
  comingSoon?: boolean;
  /**
   * Runtime handler — called when the user clicks the action button.
   * For 'list' actions this fires immediately; for 'bulk' actions it
   * fires with context.selectedIds populated.
   */
  execute: (context: ActionContext) => void | Promise<void>;
}
