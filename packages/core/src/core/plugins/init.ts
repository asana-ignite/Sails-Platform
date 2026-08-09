/**
 * Plugin system initialisation — imported at startup by the Workflow Engine.
 *
 * 1. Triggers built-in + first-party plugin self-registration (static imports
 *    — resolved BEFORE any workflow event can fire, so a cold start never
 *    skips an event because its plugin was still loading).
 * 2. Loads third-party plugins from the PLUGINS_DIR volume.
 *
 * All tiers register into the same `workflowEventRegistry` singleton
 * from `@sails/plugin-sdk`.
 */
import '@/core/engine/WorkflowEventPlugins'; // built-in self-registration
import '@sails/plugin-record-event'; // first-party self-registration
import '@sails/plugin-notification';
import '@sails/plugin-expression';
import '@sails/plugin-script';
import '@sails/plugin-approval';
import { buildPluginSDK, loadThirdPartyPlugins } from './loader';
import { startWorkflowScheduler } from '@/core/engine/WorkflowScheduler';

let initialised = false;

export function initPlugins(): void {
  if (initialised) return;
  initialised = true;

  const api = buildPluginSDK();

  // Third-party plugins (mounted volume)
  loadThirdPartyPlugins(
    process.env.PLUGINS_DIR || '/plugins',
    api,
  );

  // Completion engine: drives every running instance toward a terminal state.
  startWorkflowScheduler();
}

// Auto-run on first import — idempotent via `initialised` flag.
initPlugins();
