import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PriceBookFormSheet } from '@/components/price-books/PriceBookFormSheet';
import { bookStatus, periodLabel } from '@/components/price-books/price-book-format';
import { priceBooksApi } from '@/lib/api/price-books';
import { usePermissions } from '@/hooks/usePermissions';

/** Bảng giá: every price book with its conditions; opens the entries page. */
export function PriceBooksPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: books, isLoading } = useQuery({ queryKey: ['price-books'], queryFn: priceBooksApi.list });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Bảng giá</h1>
          <p className="text-sm text-muted-foreground">Giá riêng theo chi nhánh, nhóm khách hàng và thời gian. Mặt hàng không có trong bảng giá nào bán theo giá chung.</p>
        </div>
        {can('price_books', 'create') && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Thêm bảng giá</Button>}
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bảng giá</TableHead>
                <TableHead className="text-right">Ưu tiên</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">Mặt hàng</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Chưa có bảng giá. Mọi mặt hàng đang bán theo giá chung.</TableCell></TableRow>
              )}
              {books?.map((b) => {
                const status = bookStatus(b);
                return (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/inventory/price-books/${b.id}`)}>
                    <TableCell>
                      <div className="font-medium">{b.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{b.code}{b.allow_manual ? ' · chọn tay được' : ''}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {b.shares_priority && (
                          <Tooltip>
                            <TooltipTrigger asChild><AlertTriangle className="h-4 w-4 text-amber-600" aria-label="Trùng độ ưu tiên" /></TooltipTrigger>
                            <TooltipContent>Có bảng giá đang áp dụng khác cùng độ ưu tiên</TooltipContent>
                          </Tooltip>
                        )}
                        {b.priority}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{periodLabel(b)}</TableCell>
                    <TableCell className="text-sm">{b.all_stores ? 'Tất cả' : b.stores.map((s) => s.name).join(', ')}</TableCell>
                    <TableCell className="text-sm">{b.all_customers ? 'Tất cả' : b.groups.map((g) => g.name).join(', ')}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.entry_count}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <PriceBookFormSheet open={createOpen} onOpenChange={setCreateOpen} book={null} onSaved={(b) => navigate(`/inventory/price-books/${b.id}`)} />
    </div>
  );
}
