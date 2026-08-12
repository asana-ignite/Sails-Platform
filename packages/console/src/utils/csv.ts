/**
 * csv — CSV export/import helpers (list view export, record imports).
 */
export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatCsvRow(values: string[]): string {
  return values.map(escapeCsvField).join(',');
}

export function generateCsvBlob(headers: string[], rows: string[][]): Blob {
  const lines: string[] = [];
  lines.push(formatCsvRow(headers));
  for (const row of rows) {
    lines.push(formatCsvRow(row));
  }
  const csv = '\uFEFF' + lines.join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function downloadCsv(headers: string[], rows: string[][], filename: string): void {
  const blob = generateCsvBlob(headers, rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
