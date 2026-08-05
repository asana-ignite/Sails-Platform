import { isNPeriodMacro } from '@sails/shared';

/**
 * Resolves Query Studio context macros into concrete scalar values.
 * Multi-value macros (@my_team, @my_subordinates) resolve to their first
 * value initially; date macros return ISO YYYY-MM-DD strings; N-period
 * macros use the rule's N parameter (default 30).
 */
export function resolveContextMacro(
  macro: string,
  n: number | undefined,
  ctx: { userId: string; teams: { teamId: string }[]; role: string }
): string {
  const today = new Date();
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const addDays = (days: number) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };
  const addMonths = (months: number) => { const d = new Date(today); d.setMonth(d.getMonth() + months); return iso(d); };
  const addYears = (years: number) => { const d = new Date(today); d.setFullYear(d.getFullYear() + years); return iso(d); };
  const startOfWeek = () => { const d = new Date(today); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return iso(d); };
  const startOfMonth = () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const startOfQuarter = () => {
    const q = Math.floor(today.getMonth() / 3);
    return `${today.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  };
  const startOfYear = () => `${today.getFullYear()}-01-01`;

  const N = n && n > 0 ? n : 30;

  switch (macro) {
    case '@me': return ctx.userId;
    case '@my_team': return ctx.teams[0]?.teamId || '';
    case '@user.role': return ctx.role;
    case '@my_subordinates': return '';
    case '@today': return iso(today);
    case '@yesterday': return addDays(-1);
    case '@tomorrow': return addDays(1);
    case '@this_week': return startOfWeek();
    case '@this_month': return startOfMonth();
    case '@this_quarter': return startOfQuarter();
    case '@this_year': return startOfYear();
    case '@this_fiscal_quarter': return startOfQuarter();
    case '@this_fiscal_year': return startOfYear();
    case '@next_n_days': return addDays(N);
    case '@last_n_days': return addDays(-N);
    case '@next_n_weeks': return addDays(N * 7);
    case '@last_n_weeks': return addDays(-N * 7);
    case '@next_n_months': return addMonths(N);
    case '@last_n_months': return addMonths(-N);
    case '@next_n_years': return addYears(N);
    case '@last_n_years': return addYears(-N);
    case '@next_n_fiscal_quarters': return addMonths(N * 3);
    case '@last_n_fiscal_quarters': return addMonths(-N * 3);
    case '@next_n_fiscal_years': return addYears(N);
    case '@last_n_fiscal_years': return addYears(-N);
    default:
      return isNPeriodMacro(macro) ? addDays(N) : macro;
  }
}
