import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table/DataTable';
import type { PagedMeta, ReportResult } from '@/lib/api/reports';
import { columnsFromReport, formatCell, isNumeric } from './report-format';

interface ReportTableProps<Row extends Record<string, unknown>> {
  result?: ReportResult<Row>;
  isLoading?: boolean;
  hidden?: string[];
  /** Server-side paging controls; when set, the table shows exactly result.rows and this pager. */
  paging?: { meta: PagedMeta; onPageChange: (page: number) => void };
}

/**
 * Renders a ReportResult. Non-paged reports use the generic DataTable
 * (client sorting/paging) plus a totals row; server-paged reports render the
 * rows as-is with a page control.
 */
export function ReportTable<Row extends Record<string, unknown>>({ result, isLoading, hidden = [], paging }: ReportTableProps<Row>) {
  if (!result) {
    return <Skeleton className="h-48 w-full" />;
  }
  const columns = result.columns.filter((c) => !hidden.includes(c.key));

  if (!paging) {
    return (
      <div className="space-y-2">
        <DataTable columns={columnsFromReport(result, { hidden })} data={result.rows} isLoading={isLoading} />
        {result.totals && <TotalsTable result={result} hidden={hidden} />}
      </div>
    );
  }

  const { meta, onPageChange } = paging;
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={isNumeric(c) ? 'text-right' : undefined}>{c.header.vi}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">{isLoading ? 'Đang tải...' : 'Không có dữ liệu.'}</TableCell></TableRow>
            ) : (
              result.rows.map((row, i) => (
                <TableRow key={(row.id as string) ?? i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={isNumeric(c) ? 'text-right tabular-nums' : undefined}>{formatCell(c, row[c.key])}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <span className="text-sm text-muted-foreground">
          {meta.total.toLocaleString('vi-VN')} dòng · trang {meta.page}/{pages}
        </span>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" aria-disabled={meta.page <= 1} onClick={(e) => { e.preventDefault(); if (meta.page > 1) onPageChange(meta.page - 1); }} />
            </PaginationItem>
            {pageWindow(meta.page, pages).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink href="#" isActive={p === meta.page} onClick={(e) => { e.preventDefault(); onPageChange(p); }}>{p}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext href="#" aria-disabled={meta.page >= pages} onClick={(e) => { e.preventDefault(); if (meta.page < pages) onPageChange(meta.page + 1); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

function pageWindow(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
}

function TotalsTable<Row extends Record<string, unknown>>({ result, hidden }: { result: ReportResult<Row>; hidden: string[] }) {
  const columns = result.columns.filter((c) => !hidden.includes(c.key));
  const totals = result.totals as Record<string, unknown>;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableBody>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {columns.map((c, i) => (
              <TableCell key={c.key} className={isNumeric(c) ? 'text-right tabular-nums font-semibold' : 'font-semibold'}>
                {c.key in totals ? formatCell(c, totals[c.key]) : i === 0 ? 'Tổng cộng' : ''}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
