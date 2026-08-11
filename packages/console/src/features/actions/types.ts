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
  navigate: (path: string) => void;
  /** Trigger a data refetch on the parent list */
  refetch?: () => void;
  /** Optional: open a drawer/modal by key via ConsoleContext */
  openDrawer?: (key: string, props?: Record<string, any>) => void;
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
  /**
   * Runtime handler — called when the user clicks the action button.
   * For 'list' actions this fires immediately; for 'bulk' actions it
   * fires with context.selectedIds populated.
   */
  execute: (context: ActionContext) => void | Promise<void>;
}
