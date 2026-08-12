/**
 * registry — the shared workflowEventRegistry singleton that all built-in,
 * first-party and third-party plugins register into.
 */
import type { WorkflowEventPlugin } from './types';

/**
 * WorkflowEventRegistry — singleton registry of Workflow Event Plug-Ins.
 *
 * Built-in (first-party) plugins self-register at import time via the
 * singleton exported by this module.  Third-party plugins are loaded by
 * core's plugin loader and registered through the same singleton.
 *
 * BYOC scripts are NOT registered here — they are configurations of the
 * built-in 'script' type.
 */
export class WorkflowEventRegistry {
  private static instance: WorkflowEventRegistry;
  private plugins: Map<string, WorkflowEventPlugin>;

  private constructor() {
    this.plugins = new Map();
    // Built-in plugins self-register via side-effect imports in
    // core's WorkflowEventPlugins module — no auto-import here to
    // keep the SDK decoupled from core.
  }

  public static getInstance(): WorkflowEventRegistry {
    if (!WorkflowEventRegistry.instance) {
      WorkflowEventRegistry.instance = new WorkflowEventRegistry();
    }
    return WorkflowEventRegistry.instance;
  }

  public register(plugin: WorkflowEventPlugin): void {
    if (this.plugins.has(plugin.type)) {
      console.warn(
        `Workflow event type '${plugin.type}' is already registered and will be overwritten.`,
      );
    }
    this.plugins.set(plugin.type, plugin);
  }

  public getPlugin(type: string): WorkflowEventPlugin {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`Unregistered workflow event type: ${type}`);
    }
    return plugin;
  }

  public getAllPlugins(): WorkflowEventPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const workflowEventRegistry = WorkflowEventRegistry.getInstance();
