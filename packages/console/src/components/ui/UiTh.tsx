import React from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

export type UiSortState = 'asc' | 'desc' | 'idle';

export const UiSortIcon: React.FC<{ state?: UiSortState }> = ({ state = 'idle' }) => {
  if (state === 'asc') return <ChevronUp size={14} style={{ color: 'var(--sails-primary)' }} />;
  if (state === 'desc') return <ChevronDown size={14} style={{ color: 'var(--sails-primary)' }} />;
  return <ArrowUpDown size={14} className="ui-sort-icon" />;
};

export const UiTh: React.FC<{
  sortable?: boolean;
  sortState?: UiSortState;
  onSort?: () => void;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
  className?: string;
  children?: React.ReactNode;
}> = ({ sortable, sortState = 'idle', onSort, align, width, className, children }) => (
  <th
    className={`${sortable ? 'ui-th--sortable' : ''} ${className || ''}`}
    onClick={sortable ? onSort : undefined}
    style={{ textAlign: align, width }}
  >
    <div className="ui-th-content">
      {children}
      {sortable && <UiSortIcon state={sortState} />}
    </div>
  </th>
);

export default UiTh;
