/**
 * ActionRegistry — Singleton
 *
 * Mirrors the FieldControlRegistry pattern.
 * Built-in system actions are registered at module initialisation.
 * Future custom / BYOC actions can call ActionRegistry.getInstance().register(plugin).
 */

import type { ActionPlugin } from './types';
import { CreateAction } from './plugins/CreateAction';

export class ActionRegistry {
  private static instance: ActionRegistry;
  private actions: Map<string, ActionPlugin>;

  private constructor() {
    this.actions = new Map();

    // ── Register all built-in system actions ──
    this.register(CreateAction);
    // Future: this.register(ExportAction);
    // Future: this.register(DeleteBulkAction);
  }

  public static getInstance(): ActionRegistry {
    if (!ActionRegistry.instance) {
      ActionRegistry.instance = new ActionRegistry();
    }
    return ActionRegistry.instance;
  }

  /**
   * Register a new action plugin.
   * Logs a warning if an action with the same id is already registered.
   */
  public register(action: ActionPlugin): void {
    if (this.actions.has(action.id)) {
      console.warn(
        `[ActionRegistry] Action '${action.id}' is already registered and will be overwritten.`
      );
    }
    this.actions.set(action.id, action);
  }

  /** Retrieve a single action by its id key */
  public getAction(id: string): ActionPlugin | undefined {
    return this.actions.get(id);
  }

  /** All registered actions */
  public getAllActions(): ActionPlugin[] {
    return Array.from(this.actions.values());
  }

  /** Actions filtered by category */
  public getActionsByCategory(category: ActionPlugin['category']): ActionPlugin[] {
    return this.getAllActions().filter((a) => a.category === category);
  }
}
