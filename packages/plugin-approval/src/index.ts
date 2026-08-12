/**
 * @sails/plugin-approval — Approval event plugin. Self-registers.
 */
import { workflowEventRegistry } from '@sails/plugin-sdk';
import approvalEventPlugin from './ApprovalEventPlugin';

workflowEventRegistry.register(approvalEventPlugin);

export { approvalEventPlugin };
