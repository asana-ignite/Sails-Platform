/**
 * @sails/plugin-notification — Notification event plugin. Self-registers.
 */
import { workflowEventRegistry } from '@sails/plugin-sdk';
import notificationEventPlugin from './NotificationEventPlugin';

workflowEventRegistry.register(notificationEventPlugin);

export { notificationEventPlugin };
