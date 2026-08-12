/**
 * widget registry — maps widget-bar keys to console widget components.
 */
import { lazy } from 'react';

/**
 * Registry mapping widget componentKey to React components.
 * These render inside the Widget Bar footer.
 */
export const WidgetRegistry: Record<string, any> = {
  OmniChannelQuickAccept: lazy(() => import('./widgets/OmniChannelQuickAccept')),
  AgentChatWindows: lazy(() => import('./widgets/AgentChatWindows')),
};
