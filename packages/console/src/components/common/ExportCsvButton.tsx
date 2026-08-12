/**
 * ExportCsvButton — CSV export of the current list view (respects active
 * filters/search).
 */
import React from 'react';
import { Download } from 'lucide-react';
import { downloadCsv } from '../../utils/csv';

interface ExportCsvButtonProps {
  headers: string[];
  rows: string[][];
  filename: string;
  disabled?: boolean;
}

const ExportCsvButton: React.FC<ExportCsvButtonProps> = ({ headers, rows, filename, disabled }) => {
  const handleExport = () => {
    if (rows.length === 0) return;
    downloadCsv(headers, rows, filename);
  };

  return (
    <button
      className="sails-btn sails-btn--secondary"
      onClick={handleExport}
      disabled={disabled || rows.length === 0}
      title="Download CSV"
    >
      <Download size={18} />
      <span>Export</span>
    </button>
  );
};

export default ExportCsvButton;
