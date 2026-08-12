/**
 * @sails/plugin-script — Script (BYOC) event plugin. Self-registers.
 */
import { workflowEventRegistry } from '@sails/plugin-sdk';
import scriptEventPlugin from './ScriptEventPlugin';

workflowEventRegistry.register(scriptEventPlugin);

export { scriptEventPlugin };
