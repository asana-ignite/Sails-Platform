/**
 * JSONata intellisense support — curated function list + suggestion builder.
 * Suggestions merge JSONata's built-in $functions with workflow variables.
 */

export interface Suggestion {
  label: string;
  detail: string;
  insert: string;
  kind: 'function' | 'variable' | 'keyword';
}

export const JSONATA_FUNCTIONS: { name: string; signature: string; desc: string }[] = [
  { name: '$sum', signature: '$sum(array)', desc: 'Sum of an array of numbers' },
  { name: '$count', signature: '$count(array)', desc: 'Number of items in an array' },
  { name: '$average', signature: '$average(array)', desc: 'Average of an array of numbers' },
  { name: '$min', signature: '$min(array)', desc: 'Minimum value in an array' },
  { name: '$max', signature: '$max(array)', desc: 'Maximum value in an array' },
  { name: '$uppercase', signature: '$uppercase(string)', desc: 'Uppercase a string' },
  { name: '$lowercase', signature: '$lowercase(string)', desc: 'Lowercase a string' },
  { name: '$trim', signature: '$trim(string)', desc: 'Trim surrounding whitespace' },
  { name: '$length', signature: '$length(string)', desc: 'Length of a string' },
  { name: '$substring', signature: '$substring(s, start, len?)', desc: 'Extract part of a string' },
  { name: '$split', signature: '$split(string, sep)', desc: 'Split string into an array' },
  { name: '$join', signature: '$join(array, sep?)', desc: 'Join array into a string' },
  { name: '$contains', signature: '$contains(s, sub)', desc: 'True if s contains sub' },
  { name: '$match', signature: '$match(string, regex)', desc: 'Regex match groups' },
  { name: '$replace', signature: '$replace(s, from, to)', desc: 'Replace text' },
  { name: '$formatNumber', signature: '$formatNumber(n, pattern)', desc: 'Format a number (e.g. #,##0.00)' },
  { name: '$floor', signature: '$floor(n)', desc: 'Round down' },
  { name: '$ceil', signature: '$ceil(n)', desc: 'Round up' },
  { name: '$round', signature: '$round(n, precision?)', desc: 'Round a number' },
  { name: '$abs', signature: '$abs(n)', desc: 'Absolute value' },
  { name: '$not', signature: '$not(x)', desc: 'Logical not' },
  { name: '$and', signature: '$and(array)', desc: 'Logical and of array' },
  { name: '$or', signature: '$or(array)', desc: 'Logical or of array' },
  { name: '$map', signature: '$map(array, fn)', desc: 'Map a function over an array' },
  { name: '$filter', signature: '$filter(array, fn)', desc: 'Filter an array' },
  { name: '$sort', signature: '$sort(array, fn?)', desc: 'Sort an array' },
  { name: '$lookup', signature: '$lookup(object, key)', desc: 'Look up a key in an object' },
  { name: '$string', signature: '$string(value)', desc: 'Convert to string' },
  { name: '$number', signature: '$number(value)', desc: 'Convert to number' },
  { name: '$boolean', signature: '$boolean(value)', desc: 'Convert to boolean' },
  { name: '$exists', signature: '$exists(value)', desc: 'True if value exists' },
];

export function buildJsonataSuggestions(variables: { id: string; name: string; fieldType: string }[], query: string): Suggestion[] {
  const q = query.toLowerCase();
  const out: Suggestion[] = [];

  for (const v of variables) {
    if (!v.name) continue;
    if (q && !v.name.toLowerCase().includes(q) && !`${v.name}${v.fieldType}`.toLowerCase().includes(q)) continue;
    out.push({
      label: v.name,
      detail: `variable · ${v.fieldType}`,
      insert: v.name,
      kind: 'variable',
    });
  }

  for (const f of JSONATA_FUNCTIONS) {
    if (q && !f.name.toLowerCase().includes(q) && !f.signature.toLowerCase().includes(q)) continue;
    out.push({
      label: f.name,
      detail: f.signature,
      insert: f.name,
      kind: 'function',
    });
  }

  return out.slice(0, 40);
}
