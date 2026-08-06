import { WorkflowEventPlugin } from './WorkflowEventPlugin';
import { WorkflowEventPlugins } from '@/core/engine/WorkflowEventPlugins';

/**
 * WorkflowEventRegistry — compile-time registry of Workflow Event Plug-In
 * types. Mirrors FieldRegistry: built-ins are registered in the constructor,
 * runtime code only ever resolves a type by name. BYOC scripts are NOT
 * registered here — they are configurations of the built-in 'script' type.
 */
export class WorkflowEventRegistry {
  private static instance: WorkflowEventRegistry;
  private plugins: Map<string, WorkflowEventPlugin>;

  private constructor() {
    this.plugins = new Map();
    WorkflowEventPlugins.forEach((plugin) => this.register(plugin));
  }

  public static getInstance(): WorkflowEventRegistry {
    if (!WorkflowEventRegistry.instance) {
      WorkflowEventRegistry.instance = new WorkflowEventRegistry();
    }
    return WorkflowEventRegistry.instance;
  }

  public register(plugin: WorkflowEventPlugin): void {
    if (this.plugins.has(plugin.type)) {
      console.warn(`Workflow event type '${plugin.type}' is already registered and will be overwritten.`);
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
