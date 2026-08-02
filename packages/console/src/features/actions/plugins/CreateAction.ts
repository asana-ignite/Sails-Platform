/**
 * CreateAction — System Action Plugin
 *
 * Toolbar-level action that appears on any List View where it is enabled.
 * Navigates to the "new record" route for the model using the active app slug:
 * /:appSlug/models/:tableId/new
 *
 * category: 'list' — always visible, no selection required.
 */

import type { ActionPlugin, ActionContext } from '../types';

export const CreateAction: ActionPlugin = {
  id: 'create',
  name: 'Create',
  description: 'Opens a blank new record form for this model.',
  iconName: 'Plus',
  category: 'list',
  requiresSelection: false,
  defaultVariant: 'primary',
  defaultLabel: 'Create',

  execute(context: ActionContext): void {
    const { tableId, navigate } = context;
    const parts = window.location.pathname.split('/').filter(Boolean);
    const appSlug = parts[0] || 'admin';
    navigate(`/${appSlug}/models/${tableId}/new`);
  },
};
