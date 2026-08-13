/**
 * DeleteAction — Standard Detail Action
 *
 * Fixed step: Delete Record — shows the standard themed confirm before
 * executing. Custom events appended to this action's sections run AFTER the
 * delete succeeds (with the deleted record's snapshot as ctx.record).
 */

import type { ActionPlugin, ActionContext } from '../types';

export const DeleteAction: ActionPlugin = {
  id: 'delete',
  name: 'Delete',
  description: 'Deletes this record (with confirmation).',
  iconName: 'Trash2',
  category: 'detail',
  requiresSelection: false,
  defaultVariant: 'danger',
  defaultLabel: 'Delete',
  confirm: {
    title: 'Delete this record?',
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
  },

  async execute(context: ActionContext): Promise<void> {
    const { tableName, recordId, navigate, notifyRecordsChanged, refetch } = context;
    if (!tableName || !recordId) return;

    const res = await fetch(`/api/dynamic/${tableName}?id=${recordId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete record.');
    }
    notifyRecordsChanged?.();
    if (refetch) refetch();
    navigate(-1);
  },
};
