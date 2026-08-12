/**
 * UiBadge — status/label chip.
 */
import React from 'react';

export type UiBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'default';

export const UiBadge: React.FC<{ tone?: UiBadgeTone; className?: string; children?: React.ReactNode }> = ({ tone = 'neutral', className, children }) => (
  <span className={`ui-badge ui-badge--${tone} ${className || ''}`}>{children}</span>
);

export default UiBadge;
