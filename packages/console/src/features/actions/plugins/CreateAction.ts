/**
 * CreateAction — System Action Plugin
 *
 * Toolbar-level action that appears on any List View where it is enabled.
 * Navigates to the "new record" route for the object.
 *
 * category: 'list' — always visible, no selection required.
 */

import type { ActionPlugin, ActionContext } from '../types';

export const CreateAction: ActionPlugin = {
  id: 'create',
  name: 'Create',
  description: 'Opens a blank new record form for this object.',
  iconName: 'Plus',
  category: 'list',
  requiresSelection: false,
  defaultVariant: 'primary',
  defaultLabel: 'Create',

  execute(context: ActionContext): void {
    const { tableId, navigate, openDrawer } = context;

    // Prefer a slide-over drawer if the ConsoleContext wires one up
    if (openDrawer) {
      openDrawer('record:create', { tableId });
      return;
    }

    // Fallback: navigate to the canonical new-record route
    navigate(`/objects/${tableId}/new`);
  },
};
