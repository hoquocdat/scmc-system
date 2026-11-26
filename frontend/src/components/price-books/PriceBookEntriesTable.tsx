import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { priceBookError, priceBooksApi, type EntryRule, type PriceBookEntry } from '@/lib/api/price-books';
import { formatCurrency } from '@/lib/utils';
import { EntryRuleFields } from './EntryRuleFields';
import { ruleLabel } from './price-book-format';

const PAGE_SIZE = 50;

interface Props {
  bookId: string;
  canEdit: boolean;
}

/** Entries of a book with base price and resulting price; inline edit and remove. */
export function PriceBookEntriesTable({ bookId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id: string; rule: EntryRule } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['price-books', bookId, 'entries', search, page],
    queryFn: () => priceBooksApi.entries(bookId, { search: search || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['price-books'] });
  const onError = (e: unknown) => toast.error(priceBookError(e).message);
  const update = useMutation({
    mutationFn: (v: { id: string; rule: EntryRule }) => priceBooksApi.updateEntry(bookId, v.id, v.rule),
    onSuccess: () => { setEditing(null); refresh(); },
    onError,
  });
  const remove = useMutation({ mutationFn: (e: PriceBookEntry) => priceBooksApi.removeEntry(bookId, e.id), onSuccess: refresh, onError });

  const total = data?.pagination.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Tìm theo tên, SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hàng hóa</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Giá chung</TableHead>
                <TableHead>Cách tính</TableHead>
                <TableHead className="text-right">Giá bảng giá</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="h-24 text-center text-muted-foreground">Chưa có mặt hàng nào</TableCell></TableRow>
              )}
              {data?.data.map((e) => {
                const isEditing = editing?.id === e.id;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      {e.product_name}
                      {e.variant_name && <div className="text-xs text-muted-foreground">{e.variant_name}</div>}
                      {!e.product_variant_id && <div className="text-xs text-muted-foreground">áp dụng mọi biến thể</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.base_price)}</TableCell>
                    <TableCell>
                      {isEditing ? <EntryRuleFields compact value={editing.rule} onChange={(rule) => setEditing({ id: e.id, rule })} /> : ruleLabel(e.mode, e.value)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(e.price)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        {isEditing ? (
                          <div className="flex">
                            <Button size="icon" variant="ghost" aria-label="Lưu" disabled={update.isPending} onClick={() => update.mutate(editing)}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Bỏ" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex">
                            <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setEditing({ id: e.id, rule: { mode: e.mode, value: e.value } })}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Xóa" disabled={remove.isPending} onClick={() => remove.mutate(e)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{total.toLocaleString('vi-VN')} mặt hàng · trang {page}/{pages}</span>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(ev) => { ev.preventDefault(); if (page > 1) setPage(page - 1); }} /></PaginationItem>
            <PaginationItem><PaginationNext href="#" onClick={(ev) => { ev.preventDefault(); if (page < pages) setPage(page + 1); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
