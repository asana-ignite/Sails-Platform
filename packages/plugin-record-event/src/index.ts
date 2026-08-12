/**
 * @sails/plugin-record-event — Record Event plugin (CRUD on a model via
 * QueryLayer, RLS-enforced). Self-registers on import.
 */
import { workflowEventRegistry } from '@sails/plugin-sdk';
import recordEventPlugin from './RecordEventPlugin';

workflowEventRegistry.register(recordEventPlugin);

export { recordEventPlugin };
