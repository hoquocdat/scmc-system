import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CashEntriesMeta, CashEntryRow } from '@/lib/api/cash-book';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';

interface CashBookTableProps {
  rows?: CashEntryRow[];
  meta?: CashEntriesMeta;
  showBalance: boolean;
  isLoading?: boolean;
  onOpen: (id: string) => void;
  onPage: (page: number) => void;
}

/** Entries with receipts/payments columns, running balance for a single account, server paging. */
export function CashBookTable({ rows, meta, showBalance, isLoading, onOpen, onPage }: CashBookTableProps) {
  if (!rows || !meta) return <Skeleton className="h-64 w-full" />;
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const windowStart = Math.max(1, Math.min(meta.page - 2, pages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pages) }, (_, i) => windowStart + i);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead>
              <TableHead>Số phiếu</TableHead>
              <TableHead>Tài khoản</TableHead>
              <TableHead>Loại thu chi</TableHead>
              <TableHead>Người nộp/nhận</TableHead>
              <TableHead className="text-right">Thu</TableHead>
              <TableHead className="text-right">Chi</TableHead>
              {showBalance && <TableHead className="text-right">Tồn quỹ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {showBalance && meta.page === 1 && meta.opening != null && (
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={7} className="font-medium">Tồn đầu kỳ</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(meta.opening)}</TableCell>
              </TableRow>
            )}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={showBalance ? 8 : 7} className="h-24 text-center text-muted-foreground">{isLoading ? 'Đang tải…' : 'Không có phiếu nào'}</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className={cn('cursor-pointer', r.isCancelled && 'text-muted-foreground line-through')} onClick={() => onOpen(r.id)}>
                <TableCell className="whitespace-nowrap">{formatDateTime(r.entryDate)}</TableCell>
                <TableCell className="whitespace-nowrap font-medium">
                  {r.entryNumber}
                  {r.isCancelled && <Badge variant="destructive" className="ml-2 px-1.5 no-underline">Hủy</Badge>}
                  {!r.isAutomatic && !r.isCancelled && <Badge variant="outline" className="ml-2 px-1.5">Thủ công</Badge>}
                </TableCell>
                <TableCell>{r.account}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell className="max-w-48 truncate" title={r.note}>{r.counterparty || r.note}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-700">{r.receipt != null ? formatCurrency(r.receipt) : ''}</TableCell>
                <TableCell className="text-right tabular-nums text-red-700">{r.payment != null ? formatCurrency(r.payment) : ''}</TableCell>
                {showBalance && <TableCell className="text-right tabular-nums">{r.runningBalance != null ? formatCurrency(r.runningBalance) : ''}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <span className="text-sm text-muted-foreground">{meta.total.toLocaleString('vi-VN')} phiếu · trang {meta.page}/{pages}</span>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (meta.page > 1) onPage(meta.page - 1); }} /></PaginationItem>
            {pageNumbers.map((p) => (
              <PaginationItem key={p}><PaginationLink href="#" isActive={p === meta.page} onClick={(e) => { e.preventDefault(); onPage(p); }}>{p}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (meta.page < pages) onPage(meta.page + 1); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
