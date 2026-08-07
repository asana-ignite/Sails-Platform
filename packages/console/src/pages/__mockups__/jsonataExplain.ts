/**
 * jsonataExplain — plain-English rendering of JSONata expressions.
 *
 * Parses the expression with jsonata's own parser and walks the AST, mapping
 * constructs (ternary, comparisons, boolean logic, concatenation, common
 * functions) to human-readable text. Unknown constructs return null so the
 * UI can fall back to the raw expression — a description is never guessed.
 */
import jsonata from 'jsonata';

const parserFn: ((expr: string) => any) | null = (jsonata as any)?.parser || null;

const BIN_WORDS: Record<string, string> = {
  '=': 'equals',
  '!=': 'does not equal',
  '<': 'is less than',
  '<=': 'is at most',
  '>': 'is greater than',
  '>=': 'is at least',
  '&': 'concatenated with',
  and: 'and',
  or: 'or',
  in: 'is one of',
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '%': 'modulo',
};

const FN_WORDS: Record<string, string> = {
  uppercase: 'uppercase of',
  lowercase: 'lowercase of',
  title: 'title-cased',
  trim: 'trimmed',
  sum: 'sum of',
  count: 'count of',
  average: 'average of',
  max: 'largest of',
  min: 'smallest of',
  length: 'length of',
  abs: 'absolute value of',
  sqrt: 'square root of',
  floor: 'floor of',
  ceil: 'ceiling of',
  round: 'rounded',
  string: 'as text',
  number: 'as number',
  boolean: 'boolean value of',
  first: 'first of',
  last: 'last of',
  reverse: 'reversed',
  distinct: 'distinct values of',
  keys: 'keys of',
  values: 'values of',
  lookup: 'lookup of',
  sort: 'sorted',
  merge: 'merged',
};

/** Describe a single AST node; returns null when unsupported. */
function describe(node: any): string | null {
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
      return `variable ${node.value}`;
    case 'wildcard':
      return '*';
    case 'descendant':
      return '**';
    case 'parent':
      return '$$';

    case 'path': {
      const parts: string[] = [];
      for (const step of node.steps) {
        if (step.type === 'variable') {
          parts.push(step.value);
          continue;
        }
        if (step.type === 'function') {
          const fn = describe(step);
          if (fn === null) return null;
          parts.push(fn);
          continue;
        }
        if (['name', 'string', 'number', 'wildcard', 'parent', 'descendant'].includes(step.type)) {
          const base = describe(step);
          if (base === null) return null;
          const stages = (step.stages || [])
            .map((st: any) => (st?.type === 'filter' ? ` where ${describe(st.expr)}` : null))
            .join('');
          parts.push(base + stages);
          continue;
        }
        return null;
      }
      return parts.join('.');
    }

    case 'binary': {
      const l = describe(node.lhs);
      const r = describe(node.rhs);
      if (l === null || r === null) return null;
      const w = BIN_WORDS[node.value];
      if (!w) return null;
      return `${l} ${w} ${r}`;
    }

    case 'bind': {
      const target = node.lhs?.value;
      const r = describe(node.rhs);
      if (!target || r === null) return null;
      return `set ${target} to ${r}`;
    }

    case 'unary': {
      if (node.value === '[') {
        const inner = (node.expressions || []).map(describe);
        if (inner.some((x: string | null) => x === null)) return null;
        return `a list of ${inner.join(', ')}`;
      }
      const inner = describe(node.expression);
      if (inner === null) return null;
      if (node.value === '!') return `not ${inner}`;
      if (node.value === '-') return `negative ${inner}`;
      return null;
    }

    case 'condition': {
      const c = describe(node.condition);
      const t = describe(node.then);
      const e = describe(node.else);
      if (c === null || t === null || e === null) return null;
      return `if ${c}, then ${t}, else ${e}`;
    }

    case 'block': {
      if (!Array.isArray(node.expressions)) return null;
      const inner = node.expressions.map(describe);
      if (inner.some((x: string | null) => x === null)) return null;
      return inner.join('; then ');
    }

    case 'array': {
      const inner = (node.expressions || []).map(describe);
      if (inner.some((x: string | null) => x === null)) return null;
      return `a list of ${inner.join(', ')}`;
    }

    case 'lambda': {
      const params = (node.arguments || []).map((a: any) => describe(a));
      if (params.some((x: string | null) => x === null)) return null;
      return `each item as ${params.join(', ')}`;
    }

    case 'function': {
      const proc = node.procedure || {};
      const name = proc.value
        ?? (proc.type === 'path' ? proc.steps?.[0]?.value : undefined)
        ?? (proc.type === 'name' ? proc.value : undefined);
      const args = (node.arguments || []).map(describe);
      if (args.some((x: string | null) => x === null)) return null;
      const a0 = args[0] ?? '';
      const a1 = args[1] ?? "''";
      const a2 = args[2] ?? '';
      switch (name) {
        case 'join': return `join ${a0} with ${a1}`;
        case 'split': return `split ${a0} by ${a1}`;
        case 'replace': return `replace ${a1} with ${a2} in ${a0}`;
        case 'map': return `map ${a0} through ${a1}`;
        case 'filter': return `filter ${a0} where ${a1}`;
        case 'reduce': return `reduce ${a0} with ${a1}`;
        case 'contains': return `${a0} contains ${a1}`;
        case 'startsWith': return `${a0} starts with ${a1}`;
        case 'endsWith': return `${a0} ends with ${a1}`;
        case 'not': return `not (${a0})`;
        case 'exists': return `${a0} exists`;
        case 'substring': return `substring of ${a0} starting at ${a1}${args[2] !== undefined ? ` of length ${a2}` : ''}`;
        case undefined: {
          if (proc.type === 'lambda') {
            const body = describe(proc.body);
            if (body === null) return null;
            return `function: ${body}`;
          }
          return null;
        }
        default: {
          const word = FN_WORDS[name];
          if (word) return `${word}${args.length ? ` ${args.join(', ')}` : ''}`;
          return null;
        }
      }
    }

    case 'apply': {
      const l = describe(node.lhs);
      const r = describe(node.rhs);
      if (l === null || r === null) return null;
      return `pass ${l} through ${r}`;
    }

    case 'filter':
      return describe(node.expr);

    case 'group': {
      if (!node.lhs || typeof node.lhs !== 'object') return null;
      const kvs = Object.entries(node.lhs).map(([k, v]) => {
        const d = describe(v);
        return d === null ? null : `${k} = ${d}`;
      });
      if (kvs.some((x: string | null) => x === null)) return null;
      return `object with ${kvs.join(', ')}`;
    }

    default:
      return null;
  }
}

/**
 * Render a JSONata expression as plain English. Returns null when the
 * expression can't be parsed or contains constructs we don't describe.
 */
export function describeJsonata(expression: string): string | null {
  const trimmed = (expression || '').trim();
  if (!trimmed) return null;
  if (!parserFn) return null;
  let ast: any;
  try {
    ast = parserFn(trimmed);
  } catch {
    return null;
  }
  return describe(ast);
}

export default describeJsonata;
