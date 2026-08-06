import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const UiPagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  label?: string;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: number[];
}> = ({ page, totalPages, total, pageSize, label = 'records', onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50] }) => {
  const startRecord = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="ui-pagination">
      <div className="ui-pagination__info">
        <span className="ui-pagination__range">
          Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{total}</strong> {label}
        </span>
        {onPageSizeChange && (
          <div className="ui-pagination__page-size">
            <span className="ui-pagination__page-size-label">Records per page:</span>
            <select
              className="sails-input"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 12, height: 30 }}
              value={pageSize}
              onChange={(e) => { onPageSizeChange(Number(e.target.value)); }}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="ui-pagination__controls">
        <button className="ui-pagination__btn" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft size={16} />
        </button>
        <div className="ui-pagination__pages">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`ui-pagination__page ${page === p ? 'ui-pagination__page--active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button className="ui-pagination__btn" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages || totalPages === 0}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default UiPagination;
