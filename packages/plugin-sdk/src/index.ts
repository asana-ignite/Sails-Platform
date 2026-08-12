/**
 * @sails/plugin-sdk — the public contract for Workflow Event Plugins.
 * Third-party plugins import the registry + types from here and register
 * via register(api); first-party plugins in the monorepo import core
 * internals directly. See the packages/plugin-… family for reference
 * implementations.
 */
export type {
  WorkflowEventType,
  WorkflowEventConfigStep,
  WorkflowEventConfigParameter,
  WorkflowEventConfigParameterType,
} from '@sails/shared';

export type {
  WorkflowEventContext,
  WorkflowEventResult,
  WorkflowEventPlugin,
  PluginSDK,
} from './types';

export { WorkflowEventRegistry, workflowEventRegistry } from './registry';
