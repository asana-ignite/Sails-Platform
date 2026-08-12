/**
 * UiCard — card container for admin pages.
 */
import React from 'react';

export const UiCard: React.FC<{ className?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ className, children, style }) => (
  <div className={`ui-card ${className || ''}`} style={style}>{children}</div>
);

export default UiCard;
