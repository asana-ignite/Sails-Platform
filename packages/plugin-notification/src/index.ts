import { workflowEventRegistry } from '@sails/plugin-sdk';
import notificationEventPlugin from './NotificationEventPlugin';

workflowEventRegistry.register(notificationEventPlugin);

export { notificationEventPlugin };
