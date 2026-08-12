/**
 * UiTd — table body cell.
 */
import React from 'react';

export const UiTd: React.FC<{
  align?: 'left' | 'right' | 'center';
  className?: string;
  colSpan?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ align, className, colSpan, style, children, onClick }) => (
  <td className={`ui-td ${className || ''}`} colSpan={colSpan} style={{ textAlign: align, ...style }} onClick={onClick}>
    {children}
  </td>
);

export default UiTd;
