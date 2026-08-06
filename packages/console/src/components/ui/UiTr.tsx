import React from 'react';

export const UiTr: React.FC<{
  onClick?: () => void;
  selected?: boolean;
  locked?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ onClick, selected, locked, className, children }) => (
  <tr
    className={`ui-tr ${onClick ? 'ui-tr--clickable' : ''} ${locked ? 'ui-tr--locked' : ''} ${selected ? 'ui-tr--selected' : ''} ${className || ''}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

export default UiTr;
