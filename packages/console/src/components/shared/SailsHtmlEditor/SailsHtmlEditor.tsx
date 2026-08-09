/**
 * SailsHtmlEditor — the platform's single WYSIWYG HTML editor, built on
 * SunEditor v3 (vanilla JS, MIT, zero runtime deps).
 *
 * Replaces the two previous TipTap implementations:
 *  - RichTextControl (Layout Studio `rich_text` field type) → mode="toolbar"
 *  - HtmlNotificationEditor (Workflow Studio `html_editor` param) → mode="inline"
 *
 * Features:
 *  - Controlled `value`/`onChange` with external-reset protection
 *  - `mode="inline"` — toolbar pops out when the editing area is focused
 *  - `mode="toolbar"` — classic fixed toolbar (Layout Studio)
 *  - Toolbar presets: standard / full (Layout Studio), variable-aware (Workflow)
 *  - Full Screen + Code View buttons
 *  - Optional workflow variable integration: `{{` intellisense, `…` picker,
 *    drag-drop chips, quick chip bar, ƒ JSONata expression modal
 *  - Lucide icon set (SunEditor v3 ships Lucide SVGs natively)
 */
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import suneditor from 'suneditor';
import 'suneditor/css/editor';
import 'suneditor/css/contents';
import { PluginCommand } from 'suneditor/src/interfaces/index.js';

import blockquotePlugin from 'suneditor/src/plugins/command/blockquote.js';
import listBulletedPlugin from 'suneditor/src/plugins/command/list_bulleted.js';
import listNumberedPlugin from 'suneditor/src/plugins/command/list_numbered.js';
import alignPlugin from 'suneditor/src/plugins/dropdown/align.js';
import backgroundColorPlugin from 'suneditor/src/plugins/dropdown/backgroundColor.js';
import blockStylePlugin from 'suneditor/src/plugins/dropdown/blockStyle.js';
import fontPlugin from 'suneditor/src/plugins/dropdown/font.js';
import fontColorPlugin from 'suneditor/src/plugins/dropdown/fontColor.js';
import listPlugin from 'suneditor/src/plugins/dropdown/list.js';
import tablePlugin from 'suneditor/src/plugins/dropdown/table/index.js';
import linkPlugin from 'suneditor/src/plugins/modal/link.js';
import fontSizePlugin from 'suneditor/src/plugins/input/fontSize.js';
import imagePlugin from 'suneditor/src/plugins/modal/image/index.js';
import videoPlugin from 'suneditor/src/plugins/modal/video/index.js';
import audioPlugin from 'suneditor/src/plugins/modal/audio.js';

import { useSunEditor, type SunEditorCore } from './useSunEditor';
import type { PickerColumn } from '../../workflow/WorkflowVariablePicker';
import { WorkflowVariablePicker } from '../../workflow/WorkflowVariablePicker';
import { VariableAutocomplete } from '../../workflow/VariableAutocomplete';
import { escapeHtml, chipLabel, type PickerVariable, type PickerSchemaMap } from '../../workflow/variableTree';
import './sailsHtmlEditor.css';

export type SailsHtmlEditorMode = 'inline' | 'toolbar';
export type SailsHtmlEditorPreset = 'standard' | 'full';

export interface SailsHtmlEditorHandle {
  /** Insert raw HTML at the current caret (chip markup etc.). */
  insertHtml: (html: string) => void;
  /** Insert a `{{var}}` chip as a SunEditor inline component at the caret. */
  insertChip: (ref: string) => void;
  /** Access to the underlying SunEditor instance (advanced). */
  getEditor: () => SunEditorCore | null;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  /** inline = toolbar pops out at the top of the area on focus; toolbar = always visible. Default: 'inline'. */
  mode?: SailsHtmlEditorMode;
  /** Toolbar scope (standard/full). Default: 'full'. Ignored when `variables` is set. */
  toolbarPreset?: SailsHtmlEditorPreset;
  placeholder?: string;
  height?: string | number;
  minHeight?: string | number;
  readOnly?: boolean;
  disabled?: boolean;

  // ── Workflow variable integration (optional) ──
  variables?: PickerVariable[];
  recordSchemas?: PickerSchemaMap;
  recordSchema?: PickerColumn[];
  triggerModelFields?: PickerColumn[];
  triggerModelName?: string;
  includeOldRecord?: boolean;
  includeRequestor?: boolean;
}

const CHIP_CLASS = 'wve-chip';
/** SunEditor inline-component classes — give chips proper backspace/delete handling. */
const CHIP_COMPONENT_CLASS = 'se-component se-inline-component';

/** Build a live chip element for `$.component.insert`. */
const createChipElement = (ref: string): HTMLSpanElement => {
  const chip = document.createElement('span');
  chip.className = `${CHIP_CLASS} ${CHIP_COMPONENT_CLASS}`;
  chip.contentEditable = 'false';
  chip.setAttribute('data-ref', ref);
  chip.setAttribute('data-label', chipLabel(ref));
  chip.textContent = ref;
  return chip;
};

/** Upgrade legacy (pre-SunEditor) chips: component classes + display label.
 *  The visible label (data-label) is brace-stripped; the text content keeps
 *  the `{{...}}` markers the engine's renderTemplate substitutes. */
const normalizeChips = (html: string): string => {
  let out = html
    .replace(/class="wve-chip"/g, `class="${CHIP_CLASS} ${CHIP_COMPONENT_CLASS}"`)
    .replace(/class='wve-chip'/g, `class='${CHIP_CLASS} ${CHIP_COMPONENT_CLASS}'`);
  // Inject data-label from data-ref (skips chips that already carry it).
  out = out.replace(/(<span[^>]*data-ref="\{\{([^{}]+)\}\}")([^>]*>)/g, (m, pre: string, inner: string, post: string) =>
    pre.includes('data-label') ? m : `${pre} data-label="${inner}"${post}`);
  return out;
};

const isChipNode = (n: Node | null): n is HTMLElement =>
  !!n && n.nodeType === 1 && (n as HTMLElement).classList?.contains(CHIP_CLASS);

/** Walk back over zero-width / emptied boundary text nodes (SunEditor's ZWS markers). */
function skipBoundaryText(n: Node | null): Node | null {
  while (n && n.nodeType === Node.TEXT_NODE && (n.textContent === '' || /^[\u200B\uFEFF]+$/.test(n.textContent || ''))) {
    n = n.previousSibling;
  }
  return n;
}

/** Chip immediately before the caret (skipping trailing boundary text). */
function chipBeforeCaret(focusNode: Node, focusOffset: number): HTMLElement | null {
  let n: Node | null = null;
  if (focusNode.nodeType === Node.ELEMENT_NODE) {
    n = focusNode.childNodes[focusOffset - 1] ?? null;
  } else if (focusNode.nodeType === Node.TEXT_NODE && focusOffset === 0) {
    n = focusNode.previousSibling;
  } else {
    return null; // mid-text caret — let native backspace handle the character
  }
  if (!n) return null;
  if (isChipNode(n)) return n;
  const target = skipBoundaryText(n);
  return isChipNode(target) ? target : null;
}

/** Chip immediately after the caret (skipping leading boundary text). */
function chipAfterCaret(focusNode: Node, focusOffset: number): HTMLElement | null {
  let n: Node | null = null;
  if (focusNode.nodeType === Node.ELEMENT_NODE) {
    n = focusNode.childNodes[focusOffset] ?? null;
  } else if (focusNode.nodeType === Node.TEXT_NODE && focusOffset === (focusNode.textContent || '').length) {
    n = focusNode.nextSibling;
  } else {
    return null; // mid-text caret — let native delete handle the character
  }
  if (!n) return null;
  if (isChipNode(n)) return n;
  const target = skipBoundaryText(n);
  return isChipNode(target) ? target : null;
}

/**
 * Resolve the chip a Backspace/Delete press should remove.
 * SunEditor sometimes leaves the DOM caret inside the chip's own text node
 * after deleting adjacent text — resolve that to the chip itself.
 */
function adjacentChipForDelete(focusNode: Node, focusOffset: number, key: 'Backspace' | 'Delete'): HTMLElement | null {
  const selfChip =
    focusNode.nodeType === Node.ELEMENT_NODE
      ? (focusNode as HTMLElement).closest<HTMLElement>('.wve-chip')
      : focusNode.parentElement?.closest<HTMLElement>('.wve-chip') || null;
  if (selfChip) return selfChip;
  return key === 'Backspace' ? chipBeforeCaret(focusNode, focusOffset) : chipAfterCaret(focusNode, focusOffset);
}

/** Element whose text style a chip should reflect (nearest non-boundary sibling). */
function adjacentStyledElement(chip: HTMLElement): HTMLElement | null {
  const boundary = (n: Node | null) =>
    n && n.nodeType === Node.TEXT_NODE && (n.textContent === '' || /^[\u200B\uFEFF]+$/.test(n.textContent || '')) ? true : false;
  let n: Node | null = chip.previousSibling;
  while (n && boundary(n)) n = n.previousSibling;
  if (!n) {
    n = chip.nextSibling;
    while (n && boundary(n)) n = n.nextSibling;
  }
  if (!n) return chip.parentElement;
  if (n.nodeType === Node.ELEMENT_NODE) return n as HTMLElement;
  return (n.parentElement as HTMLElement) || chip.parentElement;
}

/** SunEditor excludes non-editable elements from text-style operations, so a
 *  chip is never wrapped in <strong>/<u>/<span style> by the toolbar. Mirror the
 *  adjacent text's weight/style/decoration/color onto the chip (inline styles)
 *  so the pill — and the substituted value in the rendered email, which
 *  inherits from the chip — display the same formatting as the surrounding text. */
function syncChipStyles(ed: SunEditorCore): void {
  const wys = ed.$.frameContext.get('wysiwyg') as HTMLElement;
  const chips = wys.querySelectorAll('.wve-chip') as NodeListOf<HTMLElement>;
  for (const chip of chips) {
    const el = adjacentStyledElement(chip);
    if (!el) continue;
    const cs = window.getComputedStyle(el);
    chip.style.fontWeight = cs.fontWeight;
    chip.style.fontStyle = cs.fontStyle;
    chip.style.textDecorationLine = cs.textDecorationLine;
    chip.style.color = cs.color;
  }
}

/** Remove the chip directly (html.remove() relies on SunEditor's internal
 *  selection which can lag the DOM caret) and restore the caret. */
function removeChipNode(ed: SunEditorCore, chip: HTMLElement): void {
  const parent = chip.parentNode;
  const before = chip.previousSibling;
  const next = chip.nextSibling;
  // Only the boundary marker AFTER the chip belongs to it — the one before it
  // is the previous chip's (or text's) trailing marker and must stay.
  const zws = next && next.nodeType === Node.TEXT_NODE && /^[\u200B\uFEFF]+$/.test(next.textContent || '') ? next : null;
  chip.remove();
  zws?.remove();
  ed.$.history.push(true);
  if (parent && parent.isConnected) {
    let target: Node = parent;
    let offset = 0;
    if (before && before.isConnected && before.parentNode === parent) {
      target = before;
      offset = before.nodeType === Node.TEXT_NODE ? (before.textContent || '').length : parent.childNodes.length;
    }
    ed.$.selection.setRange(target, offset, target, offset);
  }
  ed.$.focusManager.focus();
}


/** Module-level hook from the React host — the toolbar button's action()
 *  calls this with its button element so the host opens the picker there. */
let wvPickerOpenHook: ((target: HTMLElement | null) => void) | null = null;

/** SunEditor command plugin — a toolbar icon that opens the Workflow Variable
 *  Picker so a {{variable}} chip can be inserted into the body at the caret. */
class WvPickerButton extends PluginCommand {
  static key = 'wvVariablePicker';
  static title = 'Insert workflow variable';
  // Lucide "braces" glyph (raw SVG — SunEditor uses this as the button innerHTML).
  static innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>';
  constructor(kernel: any) {
    super(kernel);
    this.title = WvPickerButton.title;
    this.icon = WvPickerButton.innerHTML;
  }
  action(target: HTMLElement | null) {
    wvPickerOpenHook?.(target || null);
  }
}

/** SunEditor v3 plugins used by our toolbars (lean imports — no unused plugins in the bundle). */
const ALL_PLUGINS = {
  blockquote: blockquotePlugin,
  image: imagePlugin,
  video: videoPlugin,
  audio: audioPlugin,
  list_bulleted: listBulletedPlugin,
  list_numbered: listNumberedPlugin,
  align: alignPlugin,
  backgroundColor: backgroundColorPlugin,
  blockStyle: blockStylePlugin,
  font: fontPlugin,
  fontColor: fontColorPlugin,
  list: listPlugin,
  table: tablePlugin,
  link: linkPlugin,
  fontSize: fontSizePlugin,
  wvVariablePicker: WvPickerButton,
};

/** Toolbar for the Workflow composer (mode="inline"): full formatting set. */
const WORKFLOW_BUTTON_LIST: any[] = [
  ['undo', 'redo'],
  '|',
  ['font', 'fontSize'],
  '|',
  ['bold', 'italic', 'underline', 'strike'],
  '|',
  ['fontColor', 'backgroundColor'],
  '|',
  ['blockStyle'],
  '|',
  ['align'],
  '|',
  ['list_bulleted', 'list_numbered'],
  '|',
  ['outdent', 'indent'],
  '|',
  ['blockquote'],
  '|',
  ['link', 'table', 'image', 'video', 'audio'],
  '|',
  ['wvVariablePicker'],
  '|',
  ['removeFormat'],
  '|',
  ['fullScreen'],
];

/** Layout Studio — standard preset. */
const STANDARD_BUTTON_LIST: any[] = [
  ['undo', 'redo'],
  '|',
  ['bold', 'italic', 'underline', 'strike'],
  '|',
  ['list_bulleted', 'list_numbered'],
  '|',
  ['link'],
  '|',
  ['removeFormat'],
];

/** Layout Studio — full preset. */
const FULL_BUTTON_LIST: any[] = [
  ['undo', 'redo'],
  '|',
  ['font', 'fontSize'],
  '|',
  ['bold', 'italic', 'underline', 'strike'],
  '|',
  ['fontColor', 'backgroundColor'],
  '|',
  ['blockStyle'],
  '|',
  ['align'],
  '|',
  ['list_bulleted', 'list_numbered'],
  '|',
  ['outdent', 'indent'],
  '|',
  ['link', 'table', 'image', 'video', 'audio'],
  '|',
  ['removeFormat'],
  '|',
  ['fullScreen'],
];

/** Extra tags used by notification email HTML that are not in SunEditor's default whitelist. */
const EMAIL_EXTRA_TAGS = 'font|center|u|s|mark|small|big|nobr|wbr|tbody|thead|tfoot|label|strike|sup|sub|dir';

/**
 * Workflow (email) filtering: keep the HTML open for email clients
 * (arbitrary classes, data-*, inline styles) but still drop executable tags.
 * Layout Studio keeps SunEditor's strict defaults.
 */
const WORKFLOW_STRICT_MODE = {
  tagFilter: true, // keep tag whitelist (script/style/meta/link removed)
  formatFilter: false,
  classFilter: false,
  textStyleTagFilter: false,
  attrFilter: false,
  styleFilter: false,
};

/** Strict filtering for Layout Studio — SunEditor defaults, plus chip support. */
const LAYOUT_STRICT_MODE = true;

const readRefFromDataTransfer = (dt: DataTransfer | null): string => {
  let ref = dt?.getData('text/plain') || '';
  if (!ref) {
    try {
      ref = (JSON.parse(dt?.getData('application/json') || '{}') as { ref?: string })?.ref || '';
    } catch {
      /* ignore */
    }
  }
  return ref;
};

/** Text before the caret with chip contents skipped (so `{{` inside a chip never retriggers). */
function textBeforeCaret(wysiwyg: HTMLElement, focusNode: Node, focusOffset: number): string {
  const range = document.createRange();
  range.selectNodeContents(wysiwyg);
  try {
    range.setEnd(focusNode, focusOffset);
  } catch {
    return '';
  }
  let out = '';
  const walker = document.createTreeWalker(range.startContainer, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).classList?.contains(CHIP_CLASS)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Node[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    if (n === focusNode) {
      if (n.nodeType === Node.TEXT_NODE) out += (n.textContent || '').slice(0, focusOffset);
      break;
    }
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
    else if ((n as HTMLElement).tagName === 'BR') out += '\n';
  }
  return out;
}

/** Locate the text node/offset where the caret's trailing `{{query` begins. */
function findChipDeleteTarget(
  wysiwyg: HTMLElement,
  focusNode: Node,
  focusOffset: number,
): { node: Node; offset: number; text: string } | null {
  const before = textBeforeCaret(wysiwyg, focusNode, focusOffset);
  const m = before.match(/\{\{([^{}]*)$/);
  if (!m) return null;
  const targetLen = m[0].length;
  const endPos = before.length;
  const startPos = endPos - targetLen;

  const range = document.createRange();
  range.selectNodeContents(wysiwyg);
  try {
    range.setEnd(focusNode, focusOffset);
  } catch {
    return null;
  }
  const walker = document.createTreeWalker(range.startContainer, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).classList?.contains(CHIP_CLASS)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let pos = 0;
  const nodes: Node[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const len = n.nodeType === Node.TEXT_NODE ? (n.textContent || '').length : 0;
    if (n.nodeType === Node.TEXT_NODE && pos + len >= startPos) {
      return { node: n, offset: startPos - pos, text: m[1] };
    }
    pos += len;
    if (n === focusNode) break;
  }
  return null;
}

export const SailsHtmlEditor = React.forwardRef<SailsHtmlEditorHandle, Props>(function SailsHtmlEditor(
  {
    value,
    onChange,
    mode = 'inline',
    toolbarPreset = 'full',
    placeholder = '',
    height,
    minHeight,
    readOnly,
    disabled,
    variables,
    recordSchemas = {},
    recordSchema,
    triggerModelFields,
    triggerModelName,
    includeOldRecord,
    includeRequestor,
  },
  ref,
) {
  const [auto, setAuto] = useState<{ anchor: { left: number; top: number }; query: string } | null>(null);
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [wvOpenSignal, setWvOpenSignal] = useState(0);
  const wvBtnRef = useRef<HTMLElement | null>(null);

  // Route the toolbar button's action() to this editor's picker.
  useEffect(() => {
    wvPickerOpenHook = (target) => {
      wvBtnRef.current = target;
      setWvOpenSignal((n) => n + 1);
    };
    return () => {
      if (wvPickerOpenHook) wvPickerOpenHook = null;
    };
  }, []);

  const lastEmittedRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const autoDeleteRef = useRef<{ node: Node; offset: number } | null>(null);
  const closeAuto = useCallback(() => setAuto(null), []);
  const syncChipStylesLocal = useCallback(() => {
    const ed = editorRef.current;
    if (ed) syncChipStyles(ed);
  }, []);
  const syncChipStylesRef = useRef(syncChipStylesLocal);
  syncChipStylesRef.current = syncChipStylesLocal;

  const hasVariables = !!variables && variables.length > 0;
  // The variable picker is useful even with no variables — the record / oldRecord /
  // requestor context branches are always insertable. Layout Studio (no context)
  // keeps the plain toolbar.
  const hasPickerTargets = hasVariables
    || !!(recordSchema && recordSchema.length)
    || !!(triggerModelFields && triggerModelFields.length)
    || !!includeOldRecord
    || !!includeRequestor;
  const isWorkflow = hasPickerTargets;
  const buttonList = isWorkflow ? WORKFLOW_BUTTON_LIST : toolbarPreset === 'full' ? FULL_BUTTON_LIST : STANDARD_BUTTON_LIST;

  // ── Option building ────────────────────────────────────────────────
  const handlersRef = useRef({
    onChange,
    closeAuto,
  });
  handlersRef.current.onChange = onChange;
  handlersRef.current.closeAuto = closeAuto;

  const options = useMemo(
    () => ({
      mode: mode === 'inline' ? 'inline' : 'classic',
      height: height ?? (isWorkflow ? '240px' : '180px'),
      minHeight,
      // Initial content — passed once at create; later external updates flow
      // through the controlled-value sync effect below. Legacy chips are
      // upgraded to SunEditor inline components so they can be deleted.
      value: normalizeChips(valueRef.current),
      placeholder,
      plugins: ALL_PLUGINS,
      buttonList,
      strictMode: isWorkflow ? WORKFLOW_STRICT_MODE : LAYOUT_STRICT_MODE,
      elementWhitelist: isWorkflow ? EMAIL_EXTRA_TAGS : '',
      allowedClassName: CHIP_CLASS,
      attributeWhitelist: { span: 'data-ref|data-name', '*': 'data-[a-z-]+' },
      toolbar_sticky: -1,
      statusbar: false,
      shortcutsHint: false,
      // icons: SunEditor v3 ships Lucide SVGs already — no override needed.
      // v3 binds user callbacks under the `events` option key.
      events: {
        onToggleFullScreen: ({ is }: { is: boolean }) => setFullscreen(!!is),
        onFocus: () => setFocused(true),
        onBlur: () => {
          setFocused(false);
          const ed = editorRef.current;
          if (ed) ed.$.frameContext.get('wysiwyg').style.paddingTop = '';
        },
        onShowToolbar: (params: any) => {
          // Push the content down by the toolbar's measured height so the
          // floating toolbar never covers the caret / first line.
          const ed = editorRef.current;
          if (!ed) return;
          const wys = ed.$.frameContext.get('wysiwyg');
          const h = params.toolbar?.getBoundingClientRect?.().height || 0;
          wys.style.paddingTop = h > 0 ? `${Math.round(h) + 10}px` : '';
        },
        onChange: ({ data }: { data: string }) => {
          lastEmittedRef.current = data;
          handlersRef.current.onChange(data);
          syncChipStylesRef.current?.();
        },
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          // Deterministic chip deletion: bare contenteditable="false" spans are
          // treated as un-deletable barriers by SunEditor's backspace rules, so
          // we delete an adjacent chip ourselves (covers both new component
          // chips and legacy chips).
          if (event.key !== 'Backspace' && event.key !== 'Delete') return;
          const ed = editorRef.current;
          if (!ed) return;
          const sel = window.getSelection();
          if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return;
          const wys = ed.$.frameContext.get('wysiwyg');
          const focusNode = sel.focusNode;
          const focusOffset = sel.focusOffset;
          if (!focusNode || !wys.contains(focusNode)) return;
          const chip = adjacentChipForDelete(focusNode, focusOffset, event.key === 'Backspace' ? 'Backspace' : 'Delete');
          if (!chip) return;
          event.preventDefault();
          event.stopPropagation();
          removeChipNode(ed, chip);
          return false; // stop SunEditor's own keydown action execution
        },
        onKeyUp: ({ event }: { event: KeyboardEvent }) => {
          checkAutocompleteRef.current?.();
          if (event.key === 'Escape') setAuto(null);
        },
        onDrop: (params: any) => {
          const refStr = readRefFromDataTransfer(params.event?.dataTransfer ?? null);
          if (!refStr) return;
          const ed = editorRef.current;
          if (!ed) return;
          params.event.preventDefault?.();
          params.event.stopPropagation?.();
          try {
            const loc = ed.$.selection.getDragEventLocationRange(params.event);
            if (loc && loc.sc) {
              ed.$.selection.setRange(loc.sc, loc.so, loc.ec, loc.eo);
              ed.$.component.insert(createChipElement(refStr), { insertBehavior: 'none' });
              syncChipStyles(ed);
            }
          } catch (e) {
            console.error('[SailsHtmlEditor] drop insert failed', e);
          }
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, toolbarPreset, isWorkflow, placeholder],
  );

  const { containerRef, editorRef, ready } = useSunEditor(options, [mode, toolbarPreset, isWorkflow, placeholder]);

  // ── Controlled value sync (external resets only) ──────────────────
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !ready) return;
    if (value === lastEmittedRef.current) return;
    const wys = ed.$.frameContext.get('wysiwyg');
    const next = normalizeChips(value || '');
    if (wys.innerHTML !== next) {
      wys.innerHTML = next;
      syncChipStyles(ed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready]);

  // ── Disabled / read-only ──────────────────────────────────────────
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !ready) return;
    if (disabled || readOnly) ed.$.ui.disable();
    else ed.$.ui.enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, readOnly, ready]);

  // ── Imperative handle ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    insertHtml: (html: string) => {
      const ed = editorRef.current;
      if (!ed) return;
      try {
        ed.$.html.insert(html);
      } catch (e) {
        console.error('[SailsHtmlEditor] insertHtml failed', e);
      }
    },
    insertChip: (refStr: string) => {
      const ed = editorRef.current;
      if (!ed) return;
      try {
        ed.$.component.insert(createChipElement(refStr), { insertBehavior: 'none' });
        syncChipStyles(ed);
      } catch (e) {
        console.error('[SailsHtmlEditor] insertChip failed', e);
      }
    },
    getEditor: () => editorRef.current,
    focus: () => {
      const ed = editorRef.current;
      if (ed) ed.$.focusManager.focus();
    },
  }));

  // ── `{{` intellisense ─────────────────────────────────────────────
  const checkAutocomplete = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const wys = ed.$.frameContext.get('wysiwyg');
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setAuto(null);
      return;
    }
    const focusNode = sel.focusNode;
    const focusOffset = sel.focusOffset;
    if (!focusNode || !wys.contains(focusNode)) return;

    const before = textBeforeCaret(wys, focusNode, focusOffset);
    const m = before.match(/\{\{([^{}]*)$/);
    if (!m) {
      autoDeleteRef.current = null;
      setAuto(null);
      return;
    }
    const target = findChipDeleteTarget(wys, focusNode, focusOffset);
    if (!target) return;
    autoDeleteRef.current = { node: target.node, offset: target.offset };
    let rect: DOMRect;
    try {
      const range = sel.getRangeAt(0);
      rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        rect = (focusNode as Element).getBoundingClientRect ? (focusNode as Element).getBoundingClientRect() : range.getBoundingClientRect();
      }
    } catch {
      return;
    }
    setAuto({ anchor: { left: rect.left, top: rect.bottom + 2 }, query: m[1] });
  }, []);
  const checkAutocompleteRef = useRef(checkAutocomplete);
  checkAutocompleteRef.current = checkAutocomplete;

  const insertRef = useCallback((refStr: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      // Extend the current selection back to `{{` so the typed query is replaced.
      const sel = window.getSelection();
      const del = autoDeleteRef.current;
      if (sel && sel.rangeCount > 0 && del) {
        try {
          const range = sel.getRangeAt(0);
          range.setStart(del.node, del.offset);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch {
          /* node may be detached */
        }
      }
      ed.$.component.insert(createChipElement(refStr), { insertBehavior: 'none' });
      syncChipStyles(ed);
    } catch (e) {
      console.error('[SailsHtmlEditor] insertRef failed', e);
    }
    autoDeleteRef.current = null;
    setAuto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`sails-html-editor ${mode}${focused ? ' is-focused' : ''}${fullscreen ? ' is-fullscreen' : ''}${disabled || readOnly ? ' is-disabled' : ''}`}>
      {/* SunEditor mounts here */}
      <div ref={containerRef} />

      <VariableAutocomplete
        open={!!auto && !(disabled || readOnly)}
        anchor={auto?.anchor || null}
        query={auto?.query || ''}
        variables={variables || []}
        recordSchemas={recordSchemas}
        onPick={insertRef}
        onClose={closeAuto}
      />

      {/* Workflow Variable Picker — opened from the toolbar icon (anchorOverride
          points at that button; the internal trigger is hidden). */}
      {hasPickerTargets && (
        <div style={{ display: 'none' }} aria-hidden>
          <WorkflowVariablePicker
            variables={variables || []}
            recordSchemas={recordSchemas}
            recordSchema={recordSchema}
            triggerModelFields={triggerModelFields}
            triggerModelName={triggerModelName}
            includeOldRecord={includeOldRecord}
            includeRequestor={includeRequestor}
            value=""
            variant="trigger"
            format="moustache"
            anchorOverride={() => wvBtnRef.current}
            openSignal={wvOpenSignal}
            onChange={insertRef}
            onExpression={(e) => insertRef(`{{$${e}}}`)}
          />
        </div>
      )}
    </div>
  );
});

export default SailsHtmlEditor;
