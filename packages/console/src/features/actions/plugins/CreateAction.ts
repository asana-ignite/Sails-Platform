/**
 * CreateAction — System Action Plugin
 *
 * Toolbar-level action that appears on any List View where it is enabled.
 * Navigates to the "new record" route for the model using the nav path and
 * the default detail layout:
 * /test/testtype/<detailLayoutSystemName>/new
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
    const { navigate, menuPath, defaultDetailLayoutKey } = context;
    const base = menuPath?.replace(/\/+$/, '');
    if (base && defaultDetailLayoutKey) {
      navigate(`${base}/${defaultDetailLayoutKey}/new`);
    } else if (base) {
      navigate(base);
    }
  },
};
