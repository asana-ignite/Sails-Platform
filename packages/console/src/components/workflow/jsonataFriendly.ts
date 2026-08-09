/**
 * jsonataFriendly — authoring layer over JSONata for the Expression Builder.
 *
 * Users type in a friendlier syntax:
 *   if(200<500) then 'OK' else 'Not OK'      → 200 < 500 ? 'OK' : 'Not OK'
 *   Sum(amount) > 1000                       → $sum(amount) > 1000
 *
 * JSONata remains the stored/executed format. The transpiler is conservative:
 * anything it doesn't recognize passes through untouched, and the output is
 * always validated with jsonata's own parser — an ambiguous input is never
 * silently rewritten.
 */
import jsonata from 'jsonata';
import { STRUCTURED_TYPE_SUBFIELDS } from '@sails/shared';
import type { Suggestion, SuggestionVariable, RecordSchemaMap, DrillRoots } from './jsonataSuggest';

const parserFn: ((expr: string) => any) | null = (jsonata as any)?.parser || null;

/** jsonata fn name → friendly (capitalized) name. */
export const FN_FRIENDLY: Record<string, string> = {
  sum: 'Sum',
  avg: 'Avg',
  count: 'Count',
  uppercase: 'Uppercase',
  lowercase: 'Lowercase',
  trim: 'Trim',
  length: 'Length',
  concat: 'Concat',
  join: 'Join',
  split: 'Split',
  replace: 'Replace',
  substring: 'Substring',
  contains: 'Contains',
  startsWith: 'StartsWith',
  endsWith: 'EndsWith',
  map: 'Map',
  filter: 'Filter',
  reduce: 'Reduce',
  max: 'Max',
  min: 'Min',
  abs: 'Abs',
  round: 'Round',
  floor: 'Floor',
  ceil: 'Ceil',
  first: 'First',
  last: 'Last',
  not: 'Not',
  exists: 'Exists',
  boolean: 'Boolean',
  number: 'Number',
  string: 'String',
  formatNumber: 'FormatNumber',
};

/** friendly (lowercased) name → jsonata fn name. */
const FN_LOOKUP: Record<string, string> = {};
for (const [j, f] of Object.entries(FN_FRIENDLY)) FN_LOOKUP[f.toLowerCase()] = j;

const PLAIN_KEYWORDS: { label: string; insert: string; detail: string }[] = [
  { label: 'if', insert: 'if(', detail: 'conditional' },
  { label: 'then', insert: 'then ', detail: 'if branch' },
  { label: 'else', insert: 'else ', detail: 'otherwise' },
  { label: 'and', insert: 'and ', detail: 'logical and' },
  { label: 'or', insert: 'or ', detail: 'logical or' },
  { label: 'not', insert: 'not ', detail: 'negate' },
];

/**
 * Intellisense for Plain mode: workflow variables + friendly function names
 * + if/then/else keywords. Inserted text stays in friendly syntax.
 * Record variables drill down via `context` (e.g. `currentRecord.address.`)
 * exactly like the JSONata builder.
 */
export function buildPlainSuggestions(
  variables: SuggestionVariable[],
  query: string,
  context = '',
  recordSchemas?: RecordSchemaMap,
  drillRoots?: DrillRoots,
): Suggestion[] {
  const q = query.toLowerCase();
  const out: Suggestion[] = [];

  const drill = context.match(/([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.$/);
  if (drill) {
    const varName = drill[1];
    const segs = drill[2].split('.').filter(Boolean);
    const v = variables.find((x) => x.name === varName)
      || (drillRoots && drillRoots[varName] ? { name: varName, columns: drillRoots[varName] } : undefined);
    let fields = v?.columns;
    let valid = !!fields;
    if (valid) {
      for (const seg of segs) {
        const col = (fields || []).find((f) => f.fieldName === seg || f.label === seg);
        if (!col) { valid = false; break; }
        // Structured JSON types (address / lat_lng) drill into their sub-fields.
        const subs = STRUCTURED_TYPE_SUBFIELDS[col.logicalType];
        if (subs && subs.length > 0) { fields = subs; continue; }
        if (!col.targetModel || !recordSchemas) { valid = false; break; }
        fields = recordSchemas[col.targetModel];
        if (!fields) { valid = false; break; }
      }
    }
    if (valid && fields) {
      for (const f of fields) {
        if (q && !f.fieldName.toLowerCase().includes(q) && !(f.label || '').toLowerCase().includes(q)) continue;
        out.push({
          label: f.label || f.fieldName,
          detail: `field · ${f.logicalType}${f.targetModel ? ` → ${f.targetModel}` : ''}`,
          insert: f.fieldName,
          kind: 'field',
        });
      }
      return out.slice(0, 40);
    }
  }

  for (const v of variables) {
    if (!v.name) continue;
    if (q && !v.name.toLowerCase().includes(q) && !`${v.name}${v.fieldType}`.toLowerCase().includes(q)) continue;
    out.push({ label: v.name, detail: `variable · ${v.fieldType}`, insert: v.name, kind: 'variable' });
  }

  for (const [jata, friendly] of Object.entries(FN_FRIENDLY)) {
    if (q && !friendly.toLowerCase().includes(q) && !jata.toLowerCase().includes(q)) continue;
    out.push({ label: friendly, detail: `function · compiles to $${jata}(…)`, insert: `${friendly}(`, kind: 'function' });
  }

  for (const k of PLAIN_KEYWORDS) {
    if (q && !k.label.toLowerCase().includes(q)) continue;
    out.push({ label: k.label, detail: k.detail, insert: k.insert, kind: 'keyword' });
  }

  return out.slice(0, 40);
}

// ─── Scanner ──────────────────────────────────────────────────

interface Ctx {
  src: string;
  i: number;
}

const isWordChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9_$]/.test(c);
const isSpace = (c: string | undefined): boolean => !!c && /\s/.test(c);

function skipWs(ctx: Ctx): void {
  while (isSpace(ctx.src[ctx.i])) ctx.i++;
}

/** Case-insensitive word match at the cursor (word boundaries both sides). */
function matchWord(ctx: Ctx, word: string): boolean {
  const src = ctx.src;
  const i = ctx.i;
  if (src.slice(i, i + word.length).toLowerCase() !== word.toLowerCase()) return false;
  const before = src[i - 1];
  const after = src[i + word.length];
  if (isWordChar(before) || isWordChar(after)) return false;
  return true;
}

/** Consume a quoted string atom (single or double quotes). Returns it verbatim. */
function scanString(ctx: Ctx): string {
  const src = ctx.src;
  const quote = src[ctx.i];
  ctx.i++;
  let out = quote;
  while (ctx.i < src.length) {
    const c = src[ctx.i];
    out += c;
    ctx.i++;
    if (c === '\\' && ctx.i < src.length) {
      out += src[ctx.i];
      ctx.i++;
      continue;
    }
    if (c === quote) break;
  }
  return out;
}

/** Consume a balanced [ ... ] / { ... } / ( ... ) chunk verbatim (no inner transforms). */
function scanBracketChunk(ctx: Ctx): string {
  const src = ctx.src;
  const open = src[ctx.i];
  const close = open === '[' ? ']' : open === '{' ? '}' : ')';
  let depth = 0;
  let out = '';
  while (ctx.i < src.length) {
    const c = src[ctx.i];
    if (c === "'" || c === '"') {
      out += scanString(ctx);
      continue;
    }
    out += c;
    ctx.i++;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) break;
    }
  }
  return out;
}

/**
 * Scan and transform a value expression until a terminator.
 * Stops at top-level ')' / ',' / the 'else' keyword when enabled.
 *
 * `assignAllowed` is true only for the root scan: a bare `=` there is an
 * assignment (`A = B` → `$A := B`). Inside parens (if-conditions, function
 * arguments) `=` means equality; `==` means equality everywhere.
 */
function scanValue(ctx: Ctx, stopParen: boolean, stopComma: boolean, stopElse: boolean, assignAllowed = false): string {
  const src = ctx.src;
  let out = '';
  while (ctx.i < src.length) {
    const c = src[ctx.i];

    // Terminators at top level of this scan.
    if (c === ')' && stopParen) break;
    if (c === ',' && stopComma) break;
    if (stopElse && matchWord(ctx, 'else')) break;

    // Quoted strings — verbatim.
    if (c === "'" || c === '"') {
      out += scanString(ctx);
      continue;
    }

    // `=` handling: `==` equality · `!=`/`<=`/`>=` unchanged · bare `=` assigns at root.
    if (c === '=') {
      if (src[ctx.i + 1] === '=') {
        out += '=';
        ctx.i += 2;
        continue;
      }
      const prevOut = out[out.length - 1];
      if (prevOut === '!' || prevOut === '<' || prevOut === '>') {
        out += '=';
        ctx.i++;
        continue;
      }
      if (assignAllowed && !/\b(and|or)\b/.test(out) && !out.includes('==')) {
        // Assignment: `A = B` → `$A := B` ($-prefix the LHS identifier).
        const m = out.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        if (m) {
          const before = out.slice(0, out.length - m[0].length);
          const charBefore = before[before.length - 1];
          if (charBefore !== '$' && charBefore !== '.') {
            out = before + '$' + m[1];
          }
        }
        out += ' :=';
        ctx.i++;
        continue;
      }
      out += '=';
      ctx.i++;
      continue;
    }

    // Friendly if/then/else.
    if (matchWord(ctx, 'if') && src[ctx.i - 1] !== '$' && peekIfThen(ctx)) {
      out += scanIf(ctx);
      continue;
    }

    // Word: function call transform or bare identifier.
    if (/[A-Za-z_]/.test(c)) {
      const start = ctx.i;
      while (isWordChar(src[ctx.i])) ctx.i++;
      const word = src.slice(start, ctx.i);
      const prev = src[start - 1];
      const isVariableRef = prev === '$';
      // Skip whitespace to check for '('.
      let j = ctx.i;
      while (isSpace(src[j])) j++;
      if (!isVariableRef && src[j] === '(' && FN_LOOKUP[word.toLowerCase()]) {
        const fn = FN_LOOKUP[word.toLowerCase()];
        ctx.i = j; // consume '(' now
        ctx.i++; // skip '('
        const args: string[] = [];
        skipWs(ctx);
        if (src[ctx.i] === ')') {
          ctx.i++;
        } else {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const arg = scanValue(ctx, true, true, true).trim();
            args.push(arg);
            skipWs(ctx);
            if (src[ctx.i] === ',') { ctx.i++; skipWs(ctx); continue; }
            if (src[ctx.i] === ')') { ctx.i++; break; }
            break; // malformed — stop defensively
          }
        }
        out += `$${fn}(${args.join(', ')})`;
        continue;
      }
      // Plain identifier (or $name) — verbatim.
      out += word;
      continue;
    }

    // Parenthesized group: transform inside.
    if (c === '(') {
      ctx.i++;
      const inner = scanValue(ctx, true, true, true).trim();
      skipWs(ctx);
      if (src[ctx.i] === ')') ctx.i++;
      out += `(${inner})`;
      continue;
    }

    // Arrays / objects — verbatim chunk.
    if (c === '[' || c === '{') {
      out += scanBracketChunk(ctx);
      continue;
    }

    out += c;
    ctx.i++;
  }
  return out;
}

/** True when the cursor is at `if(...)` followed by `then` — a well-formed friendly conditional. */
function peekIfThen(ctx: Ctx): boolean {
  const src = ctx.src;
  let j = ctx.i + 2; // after 'if'
  if (src[j] !== '(') return false;
  let depth = 0;
  let quote = '';
  while (j < src.length) {
    const c = src[j];
    if (quote) {
      if (c === '\\') { j += 2; continue; }
      if (c === quote) quote = '';
      j++;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; j++; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
    j++;
  }
  while (isSpace(src[j])) j++;
  return src.slice(j, j + 4).toLowerCase() === 'then' && !isWordChar(src[j + 4]);
}

/**
 * Parse `if(<cond>) then <then> else <else>` at the cursor (well-formed per
 * peekIfThen); cursor ends after the else-expression.
 */
function scanIf(ctx: Ctx): string {
  const src = ctx.src;
  const start = ctx.i;
  ctx.i += 2; // 'if'
  skipWs(ctx);
  let cond = '';
  let thenTxt = '';
  let elseTxt = '';
  if (src[ctx.i] === '(') {
    ctx.i++;
    cond = scanValue(ctx, true, true, true).trim();
    skipWs(ctx);
    if (src[ctx.i] === ')') ctx.i++;
  } else {
    cond = scanValue(ctx, true, true, true).trim();
  }
  skipWs(ctx);
  if (matchWord(ctx, 'then')) {
    ctx.i += 4;
    skipWs(ctx);
    thenTxt = scanValue(ctx, true, true, true).trim();
    skipWs(ctx);
  }
  if (matchWord(ctx, 'else')) {
    ctx.i += 4;
    skipWs(ctx);
    elseTxt = scanValue(ctx, true, true, true).trim();
  }
  if (!cond || !thenTxt) {
    // Defensive: rewind and pass the raw segment through untouched.
    ctx.i = start;
    let raw = 'if';
    ctx.i += 2;
    if (src[ctx.i] === '(') raw += scanBracketChunk(ctx);
    return raw;
  }
  return elseTxt ? `(${cond}) ? ${thenTxt} : ${elseTxt}` : `(${cond}) ? ${thenTxt} : null`;
}

// ─── Public API ───────────────────────────────────────────────

export interface FriendlyResult {
  ok: boolean;
  /** The JSONata expression (validated when ok). */
  jsonata: string;
  warnings: string[];
}

/** Convert friendly authoring syntax into JSONata. Never stores on failure. */
export function friendlyToJsonata(src: string): FriendlyResult {
  const trimmed = (src || '').trim();
  if (!trimmed) return { ok: true, jsonata: '', warnings: [] };
  const ctx: Ctx = { src: trimmed, i: 0 };
  let out: string;
  try {
    out = scanValue(ctx, true, false, true, true).trim();
  } catch {
    return { ok: false, jsonata: trimmed, warnings: ['Could not parse the expression.'] };
  }
  if (parserFn) {
    try {
      parserFn(out);
      return { ok: true, jsonata: out, warnings: [] };
    } catch (e: any) {
      // The source may already be raw JSONata — pass it through unchanged.
      try {
        parserFn(trimmed);
        return { ok: true, jsonata: trimmed, warnings: [] };
      } catch {
        return { ok: false, jsonata: out, warnings: [e?.message || 'Invalid expression'] };
      }
    }
  }
  return { ok: true, jsonata: out, warnings: [] };
}

/** Pretty-print a JSONata expression back to friendly syntax (best effort). */
export function jsonataToFriendly(src: string): string {
  const trimmed = (src || '').trim();
  if (!trimmed || !parserFn) return trimmed;
  let ast: any;
  try {
    ast = parserFn(trimmed);
  } catch {
    return trimmed;
  }

  const render = (node: any): string | null => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null;
    switch (node.type) {
      case 'string':
        return `'${node.value}'`;
      case 'number':
        return String(node.value);
      case 'value':
        return String(node.value);
      case 'name':
        return node.value;
      case 'variable':
        return `$${node.value}`;
      case 'wildcard':
        return '*';
      case 'path': {
        const parts: string[] = [];
        for (const step of node.steps) {
          if (step.type === 'function') {
            const f = render(step);
            if (f === null) return null;
            parts.push(f);
          } else if (['name', 'string', 'number', 'variable', 'wildcard'].includes(step.type)) {
            const base = render(step);
            if (base === null) return null;
            parts.push(base);
          } else return null;
        }
        return parts.join('.');
      }
      case 'binary': {
        const l = render(node.lhs);
        const r = render(node.rhs);
        if (l === null || r === null) return null;
        const wrap = (s: string, n: any) => (n && (n.type === 'binary' || n.type === 'condition') ? `(${s})` : s);
        const op = node.value === '=' ? '==' : node.value;
        return `${wrap(l, node.lhs)} ${op} ${wrap(r, node.rhs)}`;
      }
      case 'bind': {
        const target = node.lhs?.value;
        const rhs = render(node.rhs);
        if (!target || rhs === null) return null;
        return `${target} = ${rhs}`;
      }
      case 'condition': {
        const c = render(node.condition);
        const t = render(node.then);
        const e = render(node.else);
        if (c === null || t === null || e === null) return null;
        return `if(${c}) then ${t} else ${e}`;
      }
      case 'function': {
        const proc = node.procedure || {};
        const name = proc.value ?? (proc.type === 'path' ? proc.steps?.[0]?.value : undefined);
        if (!name) return null;
        const friendly = FN_FRIENDLY[name];
        if (!friendly) return null;
        const args = (node.arguments || []).map(render);
        if (args.some((a: string | null) => a === null)) return null;
        return `${friendly}(${args.join(', ')})`;
      }
      case 'unary': {
        const inner = render(node.expression);
        if (inner === null) return null;
        if (node.value === '-') return `-${inner}`;
        if (node.value === '!') return `not ${inner}`;
        if (node.value === '[') {
          const items = (node.expressions || []).map(render);
          if (items.some((x: string | null) => x === null)) return null;
          return `[${items.join(', ')}]`;
        }
        return null;
      }
      case 'block': {
        const inner = (node.expressions || []).map(render);
        if (inner.some((x: string | null) => x === null)) return null;
        return inner.join('; ');
      }
      case 'array': {
        const inner = (node.expressions || []).map(render);
        if (inner.some((x: string | null) => x === null)) return null;
        return `[${inner.join(', ')}]`;
      }
      case 'filter':
        return render(node.expr);
      case 'apply': {
        const l = render(node.lhs);
        const r = render(node.rhs);
        if (l === null || r === null) return null;
        return `${l} ~> ${r}`;
      }
      case 'lambda': {
        const params = (node.arguments || []).map(render);
        const body = render(node.body);
        if (body === null) return null;
        return `function(${params.join(', ')}) { ${body} }`;
      }
      default:
        return null;
    }
  };

  const out = render(ast);
  return out ?? trimmed;
}
