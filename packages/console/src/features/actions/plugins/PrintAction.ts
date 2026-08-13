/**
 * PrintAction — Standard Detail Action (placeholder)
 *
 * Reserved for the future Document Template integration — shown disabled in
 * pickers with a "Coming Soon" badge.
 */

import type { ActionPlugin, ActionContext } from '../types';

export const PrintAction: ActionPlugin = {
  id: 'print',
  name: 'Print',
  description: 'Print this record using a Document Template (future).',
  iconName: 'Printer',
  category: 'detail',
  requiresSelection: false,
  defaultVariant: 'ghost',
  defaultLabel: 'Print',
  comingSoon: true,

  execute(_context: ActionContext): void {
    // Coming soon — never reachable from the UI.
  },
};
