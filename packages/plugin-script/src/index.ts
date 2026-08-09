import { workflowEventRegistry } from '@sails/plugin-sdk';
import scriptEventPlugin from './ScriptEventPlugin';

workflowEventRegistry.register(scriptEventPlugin);

export { scriptEventPlugin };
