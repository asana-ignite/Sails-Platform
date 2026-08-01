/**
 * features/actions — Public API
 *
 * Import from here rather than individual files to keep the dependency surface clean.
 *
 * Usage:
 *   import { ActionRegistry, type ActionPlugin } from '@/features/actions';
 */

export type { ActionPlugin, ActionContext } from './types';
export { ActionRegistry } from './ActionRegistry';

// Individual plugins (useful for tree-shaking in tests / dynamic loaders)
export { CreateAction } from './plugins/CreateAction';
