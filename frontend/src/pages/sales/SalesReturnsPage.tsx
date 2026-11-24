import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Filter, Search, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportMenu } from '@/components/reports/ExportMenu';
import { KpiCards } from '@/components/reports/KpiCards';
import { ReturnDetailSheet } from '@/components/returns/ReturnDetailSheet';
import { ReturnDoneDialog } from '@/components/returns/ReturnDoneDialog';
import { ReturnFilterBadges, ReturnFilterSheet } from '@/components/returns/ReturnFilterSheet';
import { ReturnSheet } from '@/components/returns/ReturnSheet';
import { salesReturnsApi, type SalesReturn } from '@/lib/api/sales-returns';
import { useReturnFilters } from '@/hooks/useReturnFilters';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDateTime } from '@/lib/utils';

/** Phiếu trả hàng: list with filters, totals, export; start a return; open one. */
export function SalesReturnsPage() {
  const { filters, query, setFilters, clearFilters, activeCount, openId, setOpenId } = useReturnFilters();
  const { can } = usePermissions();
  const [filterOpen, setFilterOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [done, setDone] = useState<SalesReturn | null>(null);
  const [search, setSearch] = useState(filters.search ?? '');
  const { data, isLoading } = useQuery({ queryKey: ['sales-returns', 'list', query], queryFn: () => salesReturnsApi.list(query), placeholderData: keepPreviousData });
  const meta = data?.meta;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const totals = data?.totals ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Trả hàng</h1>
          <p className="text-sm text-muted-foreground">Phiếu trả hàng và đổi hàng của mọi chi nhánh.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('sales_returns', 'create') && <Button onClick={() => setNewOpen(true)}><Undo2 className="h-4 w-4" /> Tạo phiếu trả</Button>}
          <Button variant="outline" onClick={() => setFilterOpen(true)}><Filter className="h-4 w-4" /> Lọc {activeCount > 0 && <Badge variant="secondary" className="ml-1 px-1.5">{activeCount}</Badge>}</Button>
          <ExportMenu reportKey="sales.returns" query={query} disabled={!data} />
        </div>
      </div>
      <form className="relative max-w-md" onSubmit={(e) => { e.preventDefault(); setFilters({ search: search.trim() || undefined }); }}>
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Số phiếu, số đơn, tên hoặc SĐT khách (Enter)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </form>
      <ReturnFilterBadges filters={filters} activeCount={activeCount} onChange={setFilters} onClear={() => { clearFilters(); setSearch(''); }} />
      <KpiCards
        isLoading={isLoading}
        items={meta ? [
          { label: 'Số phiếu', value: meta.total.toLocaleString('vi-VN') },
          { label: 'Giá trị hàng trả', value: formatCurrency(Number(totals.goodsAmount ?? 0)) },
          { label: 'Đã hoàn tiền', value: formatCurrency(Number(totals.refundAmount ?? 0)) },
          { label: 'Trừ công nợ', value: formatCurrency(Number(totals.receivableReduction ?? 0)) },
        ] : []}
      />
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead><TableHead>Số phiếu</TableHead><TableHead>Đơn gốc</TableHead><TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">Giá trị</TableHead><TableHead className="text-right">Hoàn tiền</TableHead><TableHead>Đơn đổi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Không có phiếu trả hàng</TableCell></TableRow>}
              {data?.rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="font-medium">{r.returnNumber} <span className="text-xs text-muted-foreground">{r.kind}</span></TableCell>
                  <TableCell>{r.orderNumber}</TableCell>
                  <TableCell className="max-w-48 truncate">{r.customer}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.goodsAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.refundAmount)}</TableCell>
                  <TableCell>{r.exchangeOrder}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {meta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Trang {meta.page}/{pages}</span>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (meta.page > 1) setFilters({ page: meta.page - 1 }); }} /></PaginationItem>
              <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (meta.page < pages) setFilters({ page: meta.page + 1 }); }} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      <ReturnFilterSheet open={filterOpen} onOpenChange={setFilterOpen} filters={filters} onApply={setFilters} onClear={clearFilters} />
      <ReturnDetailSheet id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      <ReturnSheet open={newOpen} onOpenChange={setNewOpen} onDone={setDone} />
      <ReturnDoneDialog ret={done} onOpenChange={(o) => !o && setDone(null)} />
    </div>
  );
}
