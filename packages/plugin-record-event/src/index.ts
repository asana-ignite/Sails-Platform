import { workflowEventRegistry } from '@sails/plugin-sdk';
import recordEventPlugin from './RecordEventPlugin';

workflowEventRegistry.register(recordEventPlugin);

export { recordEventPlugin };
