/**
 * @sails/plugin-expression — Expression event plugin: evaluates a JSONata
 * formula and stores the result into a workflow variable (uses the shared
 * first-party function library).
 */
import { makeJsonataEvent } from 'sails-core/src/core/engine/WorkflowEventPlugins';
import { workflowEventRegistry } from '@sails/plugin-sdk';

const expressionEventPlugin = makeJsonataEvent(
  'expression',
  'Expression Event',
  'Evaluate a JSONata expression and assign the result to a variable',
);

workflowEventRegistry.register(expressionEventPlugin);

export { expressionEventPlugin };
