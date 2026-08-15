/**
 * EditAction — Standard Detail Action
 *
 * Shows the Edit button on the detail page and enters edit mode for the
 * record. Removing the action from the layout hides the Edit button
 * (replaces the legacy layout-level `allowEdit` toggle).
 */

import type { ActionPlugin, ActionContext } from '../types';

export const EditAction: ActionPlugin = {
  id: 'edit',
  name: 'Edit',
  description: 'Shows the Edit button on the detail page and enters edit mode.',
  iconName: 'Pencil',
  category: 'detail',
  requiresSelection: false,
  defaultVariant: 'primary',
  defaultLabel: 'Edit',

  async execute(context: ActionContext): Promise<void> {
    context.onEdit?.();
  },
};
