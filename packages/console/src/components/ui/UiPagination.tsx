/**
 * UiPagination — page control.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CustomSelect, SelectOption } from '../common/CustomSelect';

export const UiPagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  label?: string;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: number[];
}> = ({ page, totalPages, total, pageSize, label, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50, 100] }) => {
  const { t } = useTranslation();
  const startRecord = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, total);

  const pageSizeSelectOptions: SelectOption[] = React.useMemo(
    () => pageSizeOptions.map((n) => ({ value: n, label: String(n) })),
    [pageSizeOptions]
  );

  const pageNumbers = React.useMemo<(number | 'ellipsis')[]>(() => {
    const items: (number | 'ellipsis')[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
        if (items.length > 0 && p - (items[items.length - 1] as number) > 1) items.push('ellipsis');
        items.push(p);
      }
    }
    return items;
  }, [totalPages, page]);

  return (
    <div className="ui-pagination">
      <div className="ui-pagination__info">
        <span className="ui-pagination__range">
          {t('common.pagination.showing')} <strong>{startRecord}</strong> {t('common.pagination.to')} <strong>{endRecord}</strong> {t('common.pagination.of')} <strong>{total}</strong> {label || t('common.pagination.records')}
        </span>
        {onPageSizeChange && (
          <div className="ui-pagination__page-size">
            <span className="ui-pagination__page-size-label">{t('common.pagination.recordsPerPage')}:</span>
            <CustomSelect
              size="sm"
              value={pageSize}
              options={pageSizeSelectOptions}
              onChange={(val) => { onPageSizeChange(Number(val)); }}
              direction="up"
            />
          </div>
        )}
      </div>
      <div className="ui-pagination__controls">
        <button className="ui-pagination__btn" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft size={16} />
        </button>
        <div className="ui-pagination__pages">
          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="ui-pagination__ellipsis">...</span>
            ) : page === p ? (
              <span key={p} className="ui-pagination__page ui-pagination__page--active">{p}</span>
            ) : (
              <button
                key={p}
                className="ui-pagination__page"
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button className="ui-pagination__btn" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages || totalPages === 0}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default UiPagination;
