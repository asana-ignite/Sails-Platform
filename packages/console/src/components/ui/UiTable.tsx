/**
 * UiTable — table shell for admin pages (User Manager, Object Manager).
 */
import React from 'react';

/** Table card wrapper (card + horizontal scroll). */
export const UiTableCard: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <div className={`ui-card ui-table-card ${className || ''}`}>{children}</div>
);

/** The table itself. */
export const UiTable: React.FC<{ className?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ className, children, style }) => (
  <table className={`ui-table ${className || ''}`} style={style}>{children}</table>
);

export default UiTable;
