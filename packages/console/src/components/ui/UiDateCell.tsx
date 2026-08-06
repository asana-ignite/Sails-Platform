import React from 'react';

export const UiDateCell: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={`ui-date-cell ${className || ''}`}>{children}</span>
);

export default UiDateCell;
