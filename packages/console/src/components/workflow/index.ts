/**
 * Workflow variable-control library — reusable controls for any event/field
 * that references workflow variables.  Every control shares the same data
 * (variables + recordSchemas), the same hierarchy picker, the same `{{`
 * intellisense, drag-and-drop, and the ƒ JSONata expression editor.
 */
export { WorkflowVariablePicker } from './WorkflowVariablePicker';
export type { PickerColumn, PickerVariable, PickerSchemaMap } from './WorkflowVariablePicker';
export { VariableAutocomplete } from './VariableAutocomplete';
export { VariableTextInput } from './VariableTextInput';
export { RecipientsChipsInput } from './RecipientsChipsInput';
export { VariableEditor } from './VariableEditor';
export { HtmlNotificationEditor } from './HtmlNotificationEditor';
export { ExpressionEditor } from './ExpressionEditor';
export {
  topNodes, colNodes, iconOf, typeLabelOf, refFromSegs, resolveAutocompleteLevel, segsForPicked, escapeHtml,
} from './variableTree';
export type { TreeNode } from './variableTree';
