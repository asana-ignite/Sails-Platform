/**
 * CloneAction — Standard Detail Action
 *
 * Fixed step: Clone Record (Deep Clone) — copies this record and optionally
 * its child records (selected in a dialog shown by the page). The copied
 * record's id is returned via context.lastResult so the page can run custom
 * events / navigate afterwards.
 */

import type { ActionPlugin, ActionContext } from '../types';

export const CloneAction: ActionPlugin = {
  id: 'clone',
  name: 'Clone',
  description: 'Copies this record — optionally including child records (deep clone).',
  iconName: 'Copy',
  category: 'detail',
  requiresSelection: false,
  defaultVariant: 'secondary',
  defaultLabel: 'Clone',

  async execute(context: ActionContext): Promise<void> {
    const { tableName, recordId, cloneInclude } = context;
    if (!tableName || !recordId) return;

    const res = await fetch(`/api/dynamic/${tableName}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recordId, include: cloneInclude || [] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to clone record.');
    }
    context.lastResult = data.record || data;
  },
};
