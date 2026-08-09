import { makeJsonataEvent } from 'sails-core/src/core/engine/WorkflowEventPlugins';
import { workflowEventRegistry } from '@sails/plugin-sdk';

const expressionEventPlugin = makeJsonataEvent(
  'expression',
  'Expression Event',
  'Evaluate a JSONata expression and assign the result to a variable',
);

workflowEventRegistry.register(expressionEventPlugin);

export { expressionEventPlugin };
