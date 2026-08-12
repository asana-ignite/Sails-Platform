/**
 * expressionFunctions — first-party function library for the JSONata engine.
 *
 * JSONata core only provides $now() / $toMillis() / $fromMillis() for dates
 * (formatting/parsing were removed from core). This dependency-free library
 * adds the date/time formulas users expect (addDays, diffDays, startOfMonth,
 * formatDate, …). It is registered by:
 *   - sails-core: WorkflowHelpers.evaluateJsonata (expression fields + workflow
 *     Expression/Transform events), and
 *   - sails-console: the ExpressionEditor Test runner (so Test == production).
 *
 * Semantics: every function is deterministic and never throws — invalid or
 * missing input returns null (matching the platform rule that a failing
 * formula stores NULL instead of blocking a write). Dates may be ISO strings,
 * Date objects, or millisecond numbers.
 */

export type ExpressionFunction = (...args: any[]) => any;

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad3 = (n: number) => String(n).padStart(3, '0');

function toDate(v: any): Date | null {
  if (v === undefined || v === null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function iso(d: Date): string {
  return d.toISOString();
}

function clampDate(d: Date, min: Date, max: Date): Date {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

function addMonthsClamped(d: Date, months: number): Date {
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

/** Token formatter: yyyy MM dd HH mm ss MMM ddd (UTC-based). */
function formatDateTokens(d: Date, pattern: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const tokens: Record<string, string> = {
    yyyy: String(d.getUTCFullYear()),
    yy: String(d.getUTCFullYear()).slice(-2),
    MM: pad2(d.getUTCMonth() + 1),
    MMM: MONTHS[d.getUTCMonth()],
    dd: pad2(d.getUTCDate()),
    HH: pad2(d.getUTCHours()),
    mm: pad2(d.getUTCMinutes()),
    ss: pad2(d.getUTCSeconds()),
    SSS: pad3(d.getUTCMilliseconds()),
    ddd: DAYS[d.getUTCDay()],
  };
  return String(pattern || 'yyyy-MM-dd').replace(/yyyy|yy|MMM|MM|dd|HH|mm|ss|SSS|ddd/g, (t) => tokens[t] ?? t);
}

function parseDateTokens(text: string, pattern: string): Date | null {
  if (!text || !pattern) return null;
  const pat = String(pattern);
  const tokRe = /yyyy|yy|MMM|MM|dd|HH|mm|ss|SSS|ddd/g;
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  let regex = '^';
  let lastEnd = 0;
  const captures: { name: string; match: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokRe.exec(pat)) !== null) {
    const sep = pat.slice(lastEnd, m.index);
    regex += sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const name = m[0];
    if (name === 'yyyy') { regex += '(\\d{4})'; captures.push({ name, match: m[0] }); }
    else if (name === 'yy') { regex += '(\\d{2})'; captures.push({ name, match: m[0] }); }
    else if (name === 'MMM') { regex += '([A-Za-z]{3})'; captures.push({ name, match: m[0] }); }
    else if (name === 'MM') { regex += '(\\d{2})'; captures.push({ name, match: m[0] }); }
    else if (name === 'dd') { regex += '(\\d{2})'; captures.push({ name, match: m[0] }); }
    else if (name === 'HH') { regex += '(\\d{2})'; captures.push({ name, match: m[0] }); }
    else if (name === 'mm') { regex += '(\\d{2})'; captures.push({ name, match: m[0] }); }
    else if (name === 'ss') { regex += '(\\d{2})'; captures.push({ name, match: m[0] }); }
    else if (name === 'SSS') { regex += '(\\d{3})'; captures.push({ name, match: m[0] }); }
    else if (name === 'ddd') { regex += '[A-Za-z]{3}'; }
    lastEnd = m.index + m[0].length;
  }
  regex += pat.slice(lastEnd).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';

  let match: RegExpMatchArray | null = null;
  try { match = String(text).match(new RegExp(regex)); } catch { return null; }
  if (!match) return null;

  const vals: Record<string, string> = {};
  captures.forEach((c, i) => { vals[c.name] = match[i + 1]; });

  let year = vals.yyyy ? Number(vals.yyyy) : vals.yy ? 2000 + Number(vals.yy) : 1970;
  let month = vals.MMM ? MONTHS[vals.MMM.toLowerCase()] ?? 0 : vals.MM ? Number(vals.MM) - 1 : 0;
  if (month < 0 || month > 11) return null;
  const day = vals.dd ? Number(vals.dd) : 1;
  const hour = vals.HH ? Number(vals.HH) : 0;
  const minute = vals.mm ? Number(vals.mm) : 0;
  const second = vals.ss ? Number(vals.ss) : 0;
  const millis = vals.SSS ? Number(vals.SSS) : 0;
  if (day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const d = new Date(Date.UTC(year, month, day, hour, minute, second, millis));
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffNumeric(a: any, b: any, unitMs: number): number | null {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  return (db.getTime() - da.getTime()) / unitMs;
}

/** Integer month difference (calendar months, not 30-day chunks). */
function diffMonths(a: any, b: any): number | null {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  const months = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
  return months;
}

/** Integer year difference (full years elapsed). */
function diffYears(a: any, b: any): number | null {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  let years = db.getUTCFullYear() - da.getUTCFullYear();
  const beforeAnniversary =
    db.getUTCMonth() < da.getUTCMonth() ||
    (db.getUTCMonth() === da.getUTCMonth() && db.getUTCDate() < da.getUTCDate());
  if (beforeAnniversary) years--;
  return years;
}

/** Public registry: function name → implementation (all args raw). */
export const EXPRESSION_FUNCTIONS: Record<string, ExpressionFunction> = {
  // ── Arithmetic ──
  addDays: (d, n) => {
    const date = toDate(d);
    if (!date || n === undefined || n === null) return null;
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    return iso(new Date(date.getTime() + num * 86400000));
  },
  addMonths: (d, n) => {
    const date = toDate(d);
    if (!date || n === undefined || n === null) return null;
    const num = Math.trunc(Number(n));
    if (!Number.isFinite(num)) return null;
    return iso(addMonthsClamped(date, num));
  },
  addYears: (d, n) => {
    const date = toDate(d);
    if (!date || n === undefined || n === null) return null;
    const num = Math.trunc(Number(n));
    if (!Number.isFinite(num)) return null;
    return iso(addMonthsClamped(date, num * 12));
  },

  // ── Truncation ──
  startOfDay: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
  },
  endOfDay: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)));
  },
  startOfMonth: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  },
  endOfMonth: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)));
  },
  startOfYear: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return iso(new Date(Date.UTC(date.getUTCFullYear(), 0, 1)));
  },
  startOfWeek: (d, startDay) => {
    const date = toDate(d);
    if (!date) return null;
    const start = startDay === undefined || startDay === null ? 0 : Math.trunc(Number(startDay));
    const offset = (date.getUTCDay() - start + 7) % 7;
    return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset)));
  },
  today: () => iso(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))),

  // ── Differences (numeric) ──
  diffSeconds: (a, b) => diffNumeric(a, b, 1000),
  diffMinutes: (a, b) => diffNumeric(a, b, 60000),
  diffHours: (a, b) => diffNumeric(a, b, 3600000),
  diffDays: (a, b) => diffNumeric(a, b, 86400000),
  diffMonths,
  diffYears,
  ageYears: (d) => diffYears(d, new Date()),

  // ── Parts ──
  year: (d) => toDate(d)?.getUTCFullYear() ?? null,
  month: (d) => (toDate(d) ? toDate(d)!.getUTCMonth() + 1 : null),
  day: (d) => toDate(d)?.getUTCDate() ?? null,
  hour: (d) => toDate(d)?.getUTCHours() ?? null,
  minute: (d) => toDate(d)?.getUTCMinutes() ?? null,
  second: (d) => toDate(d)?.getUTCSeconds() ?? null,
  weekday: (d) => toDate(d)?.getUTCDay() ?? null,
  weekdayName: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
  },
  monthName: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getUTCMonth()];
  },
  daysInMonth: (d) => {
    const date = toDate(d);
    if (!date) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  },
  isWeekend: (d) => {
    const date = toDate(d);
    if (!date) return null;
    const wd = date.getUTCDay();
    return wd === 0 || wd === 6;
  },

  // ── Format / parse ──
  formatDate: (d, pattern) => {
    const date = toDate(d);
    if (!date) return null;
    return formatDateTokens(date, pattern);
  },
  parseDate: (text, pattern) => {
    const d = parseDateTokens(text, pattern);
    return d ? iso(d) : null;
  },
};

export interface ExpressionFunctionDoc {
  name: string;
  signature: string;
  description: string;
}

/** Structured documentation for every first-party function (UI autocomplete,
 *  signatures and help text). Name is the registerFunction key (without $). */
export const EXPRESSION_FUNCTION_DOCS: ExpressionFunctionDoc[] = [
  { name: 'addDays', signature: '$addDays(date, n)', description: 'date plus n days' },
  { name: 'addMonths', signature: '$addMonths(date, n)', description: 'date plus n months (end-of-month clamped)' },
  { name: 'addYears', signature: '$addYears(date, n)', description: 'date plus n years' },
  { name: 'startOfDay', signature: '$startOfDay(date)', description: 'midnight (UTC) of the same day' },
  { name: 'endOfDay', signature: '$endOfDay(date)', description: '23:59:59.999 of the same day' },
  { name: 'startOfMonth', signature: '$startOfMonth(date)', description: 'first day of the month' },
  { name: 'endOfMonth', signature: '$endOfMonth(date)', description: 'last moment of the month' },
  { name: 'startOfYear', signature: '$startOfYear(date)', description: 'January 1st' },
  { name: 'startOfWeek', signature: '$startOfWeek(date, startDay?)', description: 'start of the week (startDay 0=Sun…6=Sat)' },
  { name: 'today', signature: '$today()', description: 'start of today (UTC)' },
  { name: 'diffSeconds', signature: '$diffSeconds(a, b)', description: 'b − a in seconds' },
  { name: 'diffMinutes', signature: '$diffMinutes(a, b)', description: 'b − a in minutes' },
  { name: 'diffHours', signature: '$diffHours(a, b)', description: 'b − a in hours' },
  { name: 'diffDays', signature: '$diffDays(a, b)', description: 'b − a in days' },
  { name: 'diffMonths', signature: '$diffMonths(a, b)', description: 'calendar months between a and b' },
  { name: 'diffYears', signature: '$diffYears(a, b)', description: 'full years between a and b' },
  { name: 'ageYears', signature: '$ageYears(birthDate)', description: 'full years since the date' },
  { name: 'year', signature: '$year(date)', description: '4-digit year' },
  { name: 'month', signature: '$month(date)', description: '1…12' },
  { name: 'day', signature: '$day(date)', description: '1…31' },
  { name: 'hour', signature: '$hour(date)', description: '0…23' },
  { name: 'minute', signature: '$minute(date)', description: '0…59' },
  { name: 'second', signature: '$second(date)', description: '0…59' },
  { name: 'weekday', signature: '$weekday(date)', description: '0=Sunday … 6=Saturday' },
  { name: 'weekdayName', signature: '$weekdayName(date)', description: 'e.g. "Monday"' },
  { name: 'monthName', signature: '$monthName(date)', description: 'e.g. "March"' },
  { name: 'daysInMonth', signature: '$daysInMonth(date)', description: '28…31' },
  { name: 'isWeekend', signature: '$isWeekend(date)', description: 'true on Saturday/Sunday' },
  { name: 'formatDate', signature: "$formatDate(date, pattern)", description: "tokens: yyyy MM dd HH mm MMM ddd (e.g. 'dd/MM/yyyy HH:mm')" },
  { name: 'parseDate', signature: "$parseDate(text, pattern)", description: 'parse with the same tokens (UTC)' },
];

export function registerExpressionFunctions(
  expressionFn: any,
  extraFunctions?: Record<string, ExpressionFunction>,
): void {
  for (const [name, fn] of Object.entries(EXPRESSION_FUNCTIONS)) {
    try {
      expressionFn.registerFunction(name, fn);
    } catch {
      /* function name already taken by the engine — built-in wins */
    }
  }
  if (extraFunctions) {
    for (const [name, fn] of Object.entries(extraFunctions)) {
      try {
        expressionFn.registerFunction(name, fn);
      } catch {
        /* ignore collisions */
      }
    }
  }
}
