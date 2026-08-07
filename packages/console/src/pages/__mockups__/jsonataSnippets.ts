/**
 * Snippet registry for the Expression Editor builder.
 * Everything is JSONata: categorized, task-oriented templates with
 * ??placeholder?? markers.
 */

export type SnippetPlaceholderKind = 'field' | 'text' | 'number';

export interface SnippetPlaceholder {
  token: string;             // the ??token?? marker inside the template
  kind: SnippetPlaceholderKind;
  /** Allowed logicalTypes for type-aware fill (kind='field' only). */
  types?: string[];
}

export interface Snippet {
  id: string;
  category: string;
  label: string;
  description: string;
  template: string;
  /** Friendly-syntax variant used in Plain mode (compiles to template). */
  friendly?: string;
  placeholders: SnippetPlaceholder[];
}

export const FIELD_TYPE_GROUPS: Record<string, string[]> = {
  text: ['text', 'short_text', 'long_text', 'rich_text', 'select', 'email', 'phone', 'address'],
  number: ['number', 'decimal', 'currency', 'percentage'],
  date: ['date', 'datetime', 'timestamp', 'time'],
  boolean: ['boolean'],
  ref: ['user', 'lookup', 'relation'],
};

/** Whether a field type matches one of the placeholder's allowed groups. */
export function fieldTypeMatches(types: string[] | undefined, fieldType: string): boolean {
  if (!types || types.length === 0) return true;
  return types.some((t) => FIELD_TYPE_GROUPS[t]?.includes(fieldType) || t === fieldType);
}

export function matchFieldTypesToGroups(fieldTypes: string[]): string[] {
  const groups = Object.keys(FIELD_TYPE_GROUPS);
  return groups.filter((g) => FIELD_TYPE_GROUPS[g].some((t) => fieldTypes.includes(t)));
}

// ─── JSONata snippets (Transform Event) ───────────────────────

export const JSONATA_SNIPPETS: Snippet[] = [
  // Combine
{ id: 'jt-concat', category: 'Combine', label: 'Join with comma', description: 'Combine two fields into one string', template: '$join([??a??, ??b??], \'??sep??\')', friendly: "Join([??a??, ??b??], '??sep??')", placeholders: [
    { token: 'a', kind: 'field', types: ['text'] },
    { token: 'b', kind: 'field', types: ['text'] },
    { token: 'sep', kind: 'text' },
  ] },
  { id: 'jt-amp', category: 'Combine', label: 'Concatenate text', description: 'Glue values together with &', template: '??a?? & \' - \' & ??b??', placeholders: [
    { token: 'a', kind: 'field' },
    { token: 'b', kind: 'field' },
  ] },
  { id: 'jt-obj', category: 'Combine', label: 'Build an object', description: 'Create a new mapped object', template: '{ \'??key1??\': ??a??, \'??key2??\': ??b?? }', placeholders: [
    { token: 'key1', kind: 'text' },
    { token: 'a', kind: 'field' },
    { token: 'key2', kind: 'text' },
    { token: 'b', kind: 'field' },
  ] },

  // Math
  { id: 'jt-sum', category: 'Math', label: 'Sum a list', description: 'Total of a numeric list', template: '$sum(??arr??)', friendly: 'Sum(??arr??)', placeholders: [
    { token: 'arr', kind: 'field' },
  ] },
  { id: 'jt-round', category: 'Math', label: 'Round number', description: 'Round to N decimals', template: '$round(??n??, ??digits??)', friendly: 'Round(??n??, ??digits??)', placeholders: [
    { token: 'n', kind: 'field', types: ['number'] },
    { token: 'digits', kind: 'number' },
  ] },
  { id: 'jt-percent', category: 'Math', label: 'Percentage of', description: 'X percent of a value', template: '??n?? * ??pct?? / 100', placeholders: [
    { token: 'n', kind: 'field', types: ['number'] },
    { token: 'pct', kind: 'number' },
  ] },
  { id: 'jt-tax', category: 'Math', label: 'Add VAT / tax', description: 'Value plus a percentage surcharge', template: '??n?? * 1.07', placeholders: [
    { token: 'n', kind: 'field', types: ['number'] },
  ] },
  { id: 'jt-avg', category: 'Math', label: 'Average a list', description: 'Mean of a numeric list', template: '$average(??arr??)', friendly: 'Avg(??arr??)', placeholders: [
    { token: 'arr', kind: 'field' },
  ] },
  { id: 'jt-abs', category: 'Math', label: 'Absolute value', description: 'Always positive', template: '$abs(??n??)', friendly: 'Abs(??n??)', placeholders: [
    { token: 'n', kind: 'field', types: ['number'] },
  ] },

  // Text
  { id: 'jt-upper', category: 'Text', label: 'Uppercase', description: 'All caps', template: '$uppercase(??text??)', friendly: 'Uppercase(??text??)', placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
  ] },
  { id: 'jt-lower', category: 'Text', label: 'Lowercase', description: 'All lower case', template: '$lowercase(??text??)', friendly: 'Lowercase(??text??)', placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
  ] },
  { id: 'jt-trim', category: 'Text', label: 'Trim spaces', description: 'Remove surrounding whitespace', template: '$trim(??text??)', friendly: 'Trim(??text??)', placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
  ] },
  { id: 'jt-sub', category: 'Text', label: 'First N characters', description: 'Take a substring from the start', template: '$substring(??text??, 0, ??n??)', friendly: 'Substring(??text??, 0, ??n??)', placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
    { token: 'n', kind: 'number' },
  ] },
{ id: 'jt-split', category: 'Text', label: 'Split by separator', description: 'Break a string into a list', template: '$split(??text??, \'??sep??\')', friendly: "Split(??text??, '??sep??')", placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
    { token: 'sep', kind: 'text' },
  ] },
{ id: 'jt-contains', category: 'Text', label: 'Contains text', description: 'True when the text includes a word', template: '$contains(??text??, \'??needle??\')', friendly: "Contains(??text??, '??needle??')", placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
    { token: 'needle', kind: 'text' },
  ] },
{ id: 'jt-replace', category: 'Text', label: 'Replace text', description: 'Swap a value for another', template: '$replace(??text??, \'??from??\', \'??to??\')', friendly: "Replace(??text??, '??from??', '??to??')", placeholders: [
    { token: 'text', kind: 'field', types: ['text'] },
    { token: 'from', kind: 'text' },
    { token: 'to', kind: 'text' },
  ] },

  // Dates
  { id: 'jt-now', category: 'Dates', label: 'Current timestamp', description: 'Now (ISO string)', template: '$now()', placeholders: [] },
{ id: 'jt-fmtnum', category: 'Dates', label: 'Format number', description: 'Thousands separator + decimals', template: '$formatNumber(??n??, \'#,##0.00\')', friendly: "FormatNumber(??n??, '#,##0.00')", placeholders: [
    { token: 'n', kind: 'field', types: ['number'] },
  ] },

  // Logic
{ id: 'jt-ternary', category: 'Logic', label: 'If / then / else', description: 'Pick one of two values by a condition', template: '??x?? > ??threshold?? ? \'yes\' : \'no\'', friendly: "if(??x?? > ??threshold??) then 'yes' else 'no'", placeholders: [
    { token: 'x', kind: 'field', types: ['number'] },
    { token: 'threshold', kind: 'number' },
  ] },
  { id: 'jt-exists', category: 'Logic', label: 'Exists check', description: 'True when the field has a value', template: '$exists(??field??)', friendly: 'Exists(??field??)', placeholders: [
    { token: 'field', kind: 'field' },
  ] },
  { id: 'jt-not', category: 'Logic', label: 'Negate', description: 'Invert true / false', template: '$not(??bool??)', friendly: 'Not(??bool??)', placeholders: [
    { token: 'bool', kind: 'field', types: ['boolean'] },
  ] },

  // Arrays
  { id: 'jt-count', category: 'Arrays', label: 'Count items', description: 'How many entries in a list', template: '$count(??arr??)', friendly: 'Count(??arr??)', placeholders: [
    { token: 'arr', kind: 'field' },
  ] },
  { id: 'jt-map', category: 'Arrays', label: 'Map over list', description: 'Transform every item', template: '$map(??arr??, function($v) { $uppercase($v) })', friendly: 'Map(??arr??, function($v) { $uppercase($v) })', placeholders: [
    { token: 'arr', kind: 'field' },
  ] },
  { id: 'jt-sort', category: 'Arrays', label: 'Sort list', description: 'Order alphabetically / numerically', template: '$sort(??arr??)', friendly: 'Sort(??arr??)', placeholders: [
    { token: 'arr', kind: 'field' },
  ] },
  { id: 'jt-filter', category: 'Arrays', label: 'Filter list', description: 'Keep matching items only', template: '$filter(??arr??, function($v) { $v.??key?? > ??n?? })', friendly: 'Filter(??arr??, function($v) { $v.??key?? > ??n?? })', placeholders: [
    { token: 'arr', kind: 'field' },
    { token: 'key', kind: 'text' },
    { token: 'n', kind: 'number' },
  ] },

  // Assignment
  { id: 'jt-assign', category: 'Assignment', label: 'Assign a value', description: 'Store a value into a workflow variable', template: '??target?? = ??value??', placeholders: [
    { token: 'target', kind: 'field' },
    { token: 'value', kind: 'text' },
  ] },
];

export const SNIPPET_CATEGORIES = [
  'Combine', 'Math', 'Text', 'Dates', 'Logic', 'Arrays', 'Objects', 'Conditions', 'Assignment',
];
