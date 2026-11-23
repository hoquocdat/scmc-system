import type { ColumnDef } from '@tanstack/react-table';
import type { ReportColumn, ReportResult } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';

const TZ = 'Asia/Ho_Chi_Minh';

/** Formats one cell according to the report column type. */
export function formatCell(column: ReportColumn, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (column.type) {
    case 'money':
      return formatCurrency(Number(value));
    case 'integer':
      return Number(value).toLocaleString('vi-VN');
    case 'number':
      return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    case 'percent':
      return `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
    case 'date':
      return new Intl.DateTimeFormat('vi-VN', { timeZone: TZ }).format(new Date(value as string));
    case 'datetime':
      return new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value as string));
    default:
      return String(value);
  }
}

export const isNumeric = (column: ReportColumn) => ['money', 'integer', 'number', 'percent'].includes(column.type);

/** Column definitions for the generic DataTable, built from the report's own columns. */
export function columnsFromReport<Row extends Record<string, unknown>>(
  result: ReportResult<Row>,
  options: { hidden?: string[]; lang?: 'vi' | 'en' } = {},
): ColumnDef<Row>[] {
  const lang = options.lang ?? 'vi';
  return result.columns
    .filter((c) => !options.hidden?.includes(c.key))
    .map((c) => ({
      id: c.key,
      accessorFn: (row) => row[c.key],
      header: () => <span className={isNumeric(c) ? 'block text-right' : undefined}>{c.header[lang]}</span>,
      cell: ({ row }) => (
        <span className={isNumeric(c) ? 'block text-right tabular-nums' : undefined}>{formatCell(c, row.original[c.key])}</span>
      ),
    }));
}
