/**
 * ExpressionEditor — builder-style code editor for the Expression and
 * Transform events. Everything is JSONata: live validation, intellisense
 * flyover, snippet library, fill-the-blanks chips, and a Test runner.
 */
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Lightbulb, Play, X, Search, Hash, Type, Sigma, CornerUpLeft } from 'lucide-react';
import { buildJsonataSuggestions, type Suggestion } from './jsonataSuggest';
import { JSONATA_SNIPPETS, fieldTypeMatches, type Snippet, type SnippetPlaceholderKind } from './jsonataSnippets';
import './ExpressionEditor.css';

interface ExpressionEditorProps {
  variables: { id: string; name: string; fieldType: string }[];
  value: string;
  onChange: (v: string) => void;
  /** Build a sample record to run the Test button. */
  sample?: Record<string, any>;
  placeholder?: string;
  compact?: boolean;
  /** Show the snippet library panel (modal usage). */
  showSnippets?: boolean;
}

interface PendingFill {
  token: string;
  kind: SnippetPlaceholderKind;
  types?: string[];
}

// ─── Token highlighting ───────────────────────────────────────

interface TokenSpan {
  text: string;
  cls: string;
}

function tokenizeHighlight(src: string): TokenSpan[] {
  const out: TokenSpan[] = [];
  let i = 0;
  const n = src.length;
  const funcRe = /\$[A-Za-z_][A-Za-z0-9_]*/;
  const stringRe = /'[^']*'|"[^"]*"/;
  const numberRe = /\d+(\.\d+)?/;
  const varRe = /[A-Za-z_][A-Za-z0-9_]*/;
  const opRe = /[=<>!+\-*/%?:&,()[\]{}]/;

  while (i < n) {
    const rest = src.slice(i);
    if (/^\s/.test(rest)) {
      const m = rest.match(/^\s+/)!;
      out.push({ text: m[0], cls: '' });
      i += m[0].length;
      continue;
    }
    let matched = false;
    for (const [re, cls] of [
      [stringRe, 'ex-hl--string'],
      [numberRe, 'ex-hl--number'],
      [funcRe, 'ex-hl--func'],
      [varRe, 'ex-hl--var'],
      [opRe, 'ex-hl--op'],
    ] as const) {
      const m = rest.match(re);
      if (m && m.index === 0) {
        out.push({ text: m[0], cls });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ text: src[i], cls: '' });
      i++;
    }
  }
  return out;
}

// ─── Assignment detection (JSONata) ───────────────────────────

export interface AssignmentInfo {
  target: string;
  /** true when the expression is a single top-level binding. */
  isAssignment: boolean;
  /** Expression rewritten for evaluation when needed. */
  evalExpr: string;
}

/**
 * Detect a top-level JSONata binding like `$total := $sum(items)` or
 * `total := $sum(items)` (translated to `$total := ...` for evaluation).
 */
export function detectAssignment(value: string): AssignmentInfo {
  const trimmed = value.trim();
  if (!trimmed) return { target: '', isAssignment: false, evalExpr: value };

  const native = trimmed.match(/^\s*\$?([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*([\s\S]+)$/);
  if (native) {
    const target = native[1];
    return { target, isAssignment: true, evalExpr: target.startsWith('$') ? value : `$${target} := ${native[2]}` };
  }
  return { target: '', isAssignment: false, evalExpr: value };
}

// ─── Component ────────────────────────────────────────────────

export const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  variables,
  value,
  onChange,
  sample,
  placeholder,
  compact,
  showSnippets,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [popupPos, setPopupPos] = useState<{ left: number; top: number; width: number; flip: boolean } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [pendingFills, setPendingFills] = useState<PendingFill[]>([]);
  const [activeFillToken, setActiveFillToken] = useState<string | null>(null);
  const [fillTextDraft, setFillTextDraft] = useState('');
  const [snippetSearch, setSnippetSearch] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const hlRef = useRef<HTMLPreElement | null>(null);

  const snippets = JSONATA_SNIPPETS;
  const filteredSnippets = useMemo(() => {
    const q = snippetSearch.trim().toLowerCase();
    if (!q) return snippets;
    return snippets.filter((s) =>
      s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
  }, [snippets, snippetSearch]);
  const snippetCategories = useMemo(() => {
    const seen: string[] = [];
    for (const s of filteredSnippets) if (!seen.includes(s.category)) seen.push(s.category);
    return seen;
  }, [filteredSnippets]);

  const tokens = useMemo(() => tokenizeHighlight(value), [value]);
  const assignment = useMemo(() => detectAssignment(value), [value]);

  const [jsonataLib, setJsonataLib] = useState<any>(null);
  const [jsonataLoadError, setJsonataLoadError] = useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    import('jsonata').then((mod) => {
      if (mounted) { setJsonataLib(() => mod.default); setJsonataLoadError(null); }
    }).catch(() => {
      if (mounted) setJsonataLoadError('Failed to load jsonata');
    });
    return () => { mounted = false; };
  }, []);

  const jsonataParseError = useMemo(() => {
    if (!value.trim()) return null;
    if (jsonataLoadError) return jsonataLoadError;
    if (!jsonataLib) return null;
    try {
      jsonataLib(assignment.evalExpr);
      return null;
    } catch (err: any) {
      return err?.message || 'Invalid JSONata expression';
    }
  }, [value, assignment.evalExpr, jsonataLib, jsonataLoadError]);

  const validation = { ok: !jsonataParseError, message: jsonataParseError || (value.trim() ? 'Expression OK' : '') };

  /** Measure the textarea and anchor the flyover popup to it (viewport coords). */
  const measurePopup = () => {
    const el = taRef.current;
    if (!el) { setPopupPos(null); return; }
    const r = el.getBoundingClientRect();
    const flip = window.innerHeight - r.bottom < 280;
    setPopupPos({ left: r.left, top: r.bottom + 4, width: r.width, flip });
  };

  React.useEffect(() => {
    if (!suggestions || suggestions.length === 0) return;
    measurePopup();
    const onScroll = () => measurePopup();
    const onResize = () => measurePopup();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  // ── Snippet insert + fill-the-blanks ──
  const insertSnippet = (s: Snippet) => {
    onChange(s.template);
    setPendingFills([...s.placeholders]);
    setActiveFillToken(null);
    setTestResult(null);
    setRunError(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const applyFill = (token: string, raw: string) => {
    const marker = `??${token}??`;
    const text = raw.trim();
    // Replace all occurrences of the marker.
    const next = value.split(marker).join(text);
    onChange(next);
    setPendingFills((prev) => prev.filter((p) => p.token !== token));
    setActiveFillToken(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const openFill = (token: string, kind: SnippetPlaceholderKind) => {
    setActiveFillToken(activeFillToken === token ? null : token);
    setFillTextDraft('');
  };

  // ── Intellisense ──
  const openSuggestions = () => {
    if (!value.trim()) {
      setSuggestions(buildJsonataSuggestions(variables, ''));
      setSuggestIndex(0);
      return;
    }
    const word = (value.match(/[A-Za-z_$][A-Za-z0-9_$]*$/) || [''])[0];
    setSuggestions(buildJsonataSuggestions(variables, word.replace(/^\$/, '')));
    setSuggestIndex(0);
  };

  const applySuggestion = (s: Suggestion) => {
    if (!taRef.current) return;
    const el = taRef.current;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const wordMatch = before.match(/([A-Za-z0-9_$]*)$/);
    const wordStart = wordMatch ? start - wordMatch[1].length : start;
    const next = value.slice(0, wordStart) + s.insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = wordStart + s.insert.length;
      el.setSelectionRange(caret, caret);
    });
    setSuggestions(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestIndex((i) => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestIndex((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (suggestIndex >= 0 && suggestions[suggestIndex]) {
          e.preventDefault();
          applySuggestion(suggestions[suggestIndex]);
          return;
        }
      }
      if (e.key === 'Escape') { setSuggestions(null); return; }
    }
    if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); setSuggestions(null); return; }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setTestResult(null);
    // Sync the highlight scroll position.
    if (hlRef.current) {
      hlRef.current.scrollTop = e.currentTarget.scrollTop;
      hlRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    const word = (e.target.value.match(/[A-Za-z_$][A-Za-z0-9_$]*$/) || [''])[0];
    if (word.length >= 1) {
      const list = buildJsonataSuggestions(variables, word.replace(/^\$/, ''));
      if (list.length > 0) { setSuggestions(list); setSuggestIndex(0); }
      else setSuggestions(null);
    } else {
      setSuggestions(null);
    }
  };

  const runTest = async () => {
    if (!value.trim()) return;
    if (!jsonataLib) { setRunError('JSONata engine not loaded yet — try again in a moment.'); return; }
    setRunning(true);
    setTestResult(null);
    setRunError(null);
    try {
      const expression = jsonataLib(assignment.evalExpr);
      const ctx = sample || {};
      const out = await expression.evaluate(ctx);
      setTestResult({ ok: true, text: JSON.stringify(out, null, 2) });
    } catch (err: any) {
      setRunError(err?.message || 'Failed to evaluate expression');
    } finally {
      setRunning(false);
    }
  };

  const activeFill = pendingFills.find((p) => p.token === activeFillToken) || null;
  const fillCandidates = activeFill
    ? variables.filter((v) => v.name && fieldTypeMatches(activeFill.types, v.fieldType))
    : [];

  return (
    <div className={`ex-editor ex-editor--jsonata ${compact ? 'ex-editor--compact' : ''}`}>
      {showSnippets && (
        <div className="ex-editor__snippets">
          <div className="ex-editor__snippets-head">
            <Lightbulb size={12} /> Snippets
          </div>
          <div className="ex-editor__snippets-search">
            <Search size={11} />
            <input
              className="ex-editor__snippets-search-input"
              placeholder="Search snippets…"
              value={snippetSearch}
              onChange={(e) => setSnippetSearch(e.target.value)}
            />
          </div>
          <div className="ex-editor__snippets-list">
            {snippetCategories.length === 0 && (
              <p className="ex-editor__snippets-empty">No snippets match your search.</p>
            )}
            {snippetCategories.map((cat) => (
              <div key={cat} className="ex-editor__snippet-cat">
                <div className="ex-editor__snippet-cat-head">{cat}</div>
                {filteredSnippets.filter((s) => s.category === cat).map((s) => (
                  <button key={s.id} type="button" className="ex-editor__snippet" onClick={() => insertSnippet(s)}>
                    <span className="ex-editor__snippet-label">{s.label}</span>
                    <span className="ex-editor__snippet-desc">{s.description}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ex-editor__main">
        <div className="ex-editor__area">
          <pre ref={hlRef} className="ex-editor__hl" aria-hidden>
            {tokens.map((t, i) => (t.cls ? <span key={i} className={t.cls}>{t.text}</span> : t.text))}
          </pre>
          <textarea
            ref={taRef}
            className="ex-editor__input"
            value={value}
            placeholder={placeholder || 'e.g. $sum(amount) + 1000'}
            spellCheck={false}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => { setSuggestions(null); }}
            onFocus={openSuggestions}
            onScroll={(e) => {
              if (hlRef.current) {
                hlRef.current.scrollTop = e.currentTarget.scrollTop;
                hlRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            rows={compact ? 2 : 5}
          />

          {suggestions && suggestions.length > 0 && popupPos && createPortal(
            <div
              className={`ex-editor__suggest ex-editor__suggest--flyover ${popupPos.flip ? 'ex-editor__suggest--above' : ''}`}
              style={popupPos.flip
                ? { left: popupPos.left, bottom: window.innerHeight - popupPos.top + 4, width: popupPos.width }
                : { left: popupPos.left, top: popupPos.top, width: popupPos.width }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="ex-editor__suggest-head">
                <Lightbulb size={11} /> Suggestions
              </div>
              {suggestions.map((s, i) => (
                <button
                  key={`${s.kind}-${s.label}`}
                  type="button"
                  className={`ex-editor__suggest-item ${i === suggestIndex ? 'ex-editor__suggest-item--active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                  onMouseEnter={() => setSuggestIndex(i)}
                >
                  <span className={`ex-editor__suggest-kind ex-editor__suggest-kind--${s.kind}`}>{s.kind === 'function' ? 'ƒ' : '#'}</span>
                  <span className="ex-editor__suggest-label">{s.label}</span>
                  <span className="ex-editor__suggest-detail">{s.detail}</span>
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>

        {/* Fill-the-blanks bar */}
        {pendingFills.length > 0 && (
          <div className="ex-editor__fills">
            <span className="ex-editor__fills-title">Fill the blanks:</span>
            {pendingFills.map((p) => (
              <span key={p.token} className="ex-editor__fill-wrap">
                <button
                  type="button"
                  className={`ex-editor__fill-chip ${activeFillToken === p.token ? 'ex-editor__fill-chip--active' : ''}`}
                  onClick={() => openFill(p.token, p.kind)}
                >
                  {p.kind === 'field' ? <Hash size={10} /> : p.kind === 'number' ? <Sigma size={10} /> : <Type size={10} />}
                  {p.token}
                  <span className="ex-editor__fill-chev">▾</span>
                </button>
                {activeFillToken === p.token && (
                  <div className="ex-editor__fill-picker" onClick={(e) => e.stopPropagation()}>
                    {p.kind === 'field' ? (
                      <>
                        {fillCandidates.length === 0 && (
                          <p className="ex-editor__fill-hint">No matching workflow variables of the required type.</p>
                        )}
                        {fillCandidates.map((v) => (
                          <button key={v.id} type="button" className="ex-editor__fill-opt" onClick={() => applyFill(p.token, v.name)}>
                            <span className="ex-editor__fill-opt-name">{v.name}</span>
                            <span className="ex-editor__fill-opt-type">{v.fieldType}</span>
                          </button>
                        ))}
                        <div className="ex-editor__fill-custom">
                          <input
                            className="sails-input"
                            placeholder="Custom value…"
                            value={fillTextDraft}
                            onChange={(e) => setFillTextDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyFill(p.token, fillTextDraft); }}
                          />
                          <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => applyFill(p.token, fillTextDraft)}>
                            OK
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="ex-editor__fill-custom">
                        <input
                          className="sails-input"
                          autoFocus
                          placeholder={p.kind === 'number' ? 'Number…' : 'Text…'}
                          value={fillTextDraft}
                          onChange={(e) => setFillTextDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') applyFill(p.token, fillTextDraft); }}
                        />
                        <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => applyFill(p.token, fillTextDraft)}>
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="ex-editor__footer">
          <span className={`ex-editor__status ${validation.ok ? 'ex-editor__status--ok' : 'ex-editor__status--err'}`}>
            {validation.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            <span>{validation.message || (value.trim() ? 'Expression OK' : 'Empty expression')}</span>
          </span>

          {assignment.isAssignment && (
            <span className="ex-editor__assign-badge" title="This expression assigns its result to a workflow variable">
              <CornerUpLeft size={11} /> assigns to: <code>{assignment.target}</code>
            </span>
          )}

          <div className="ex-editor__test">
            <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={runTest} disabled={running || !value.trim()}>
              <Play size={11} /> {running ? 'Running…' : 'Test'}
            </button>
            {testResult && (
              <span className="ex-editor__test-result">
                <span className="ex-editor__test-badge ex-editor__test-badge--ok">✓</span>
                <code>{testResult.text}</code>
              </span>
            )}
            {runError && (
              <span className="ex-editor__test-result">
                <span className="ex-editor__test-badge ex-editor__test-badge--err">✗</span>
                <code>{runError}</code>
              </span>
            )}
            {(testResult || runError) && (
              <button type="button" className="ex-editor__test-clear" title="Clear result" onClick={() => { setTestResult(null); setRunError(null); }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpressionEditor;
