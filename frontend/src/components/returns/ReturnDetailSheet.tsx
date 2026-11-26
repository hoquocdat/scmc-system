import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { money, REASON_LABELS, REFUND_METHOD_LABELS, salesReturnsApi } from '@/lib/api/sales-returns';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { printElement } from '@/lib/utils/print';
import { ReturnReceipt } from './ReturnReceipt';

/** One return: lines, where the money went, links to the orders, reprint. */
export function ReturnDetailSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: r, isLoading } = useQuery({ queryKey: ['sales-returns', 'detail', id], queryFn: () => salesReturnsApi.get(id!), enabled: !!id });
  const order = r?.sales_orders_sales_returns_sales_order_idTosales_orders;
  const exchange = r?.sales_orders_sales_returns_exchange_order_idTosales_orders;

  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle className="flex items-center gap-2">{r?.return_number ?? 'Phiếu trả hàng'} {r && <Badge variant="secondary">{r.kind === 'exchange' ? 'Đổi hàng' : 'Trả hàng'}</Badge>}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {r && order && (
            <>
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Thời gian</dt><dd>{formatDateTime(r.created_at)}</dd>
                <dt className="text-muted-foreground">Đơn gốc</dt><dd><Link className="underline" to={`/sales/orders/${order.id}`}>{order.order_number}</Link></dd>
                {exchange && (<><dt className="text-muted-foreground">Đơn đổi</dt><dd><Link className="underline" to={`/sales/orders/${exchange.id}`}>{exchange.order_number}</Link> · {formatCurrency(money(exchange.total_amount))}</dd></>)}
                <dt className="text-muted-foreground">Khách hàng</dt><dd>{r.customers ? `${r.customers.full_name} · ${r.customers.phone ?? ''}` : 'Khách lẻ'}</dd>
                <dt className="text-muted-foreground">Người tạo</dt><dd>{r.user_profiles_sales_returns_created_byTouser_profiles?.full_name ?? '—'}{r.user_profiles_sales_returns_approved_byTouser_profiles ? ` · duyệt: ${r.user_profiles_sales_returns_approved_byTouser_profiles.full_name}` : ''}</dd>
                {r.reason && (<><dt className="text-muted-foreground">Ghi chú</dt><dd>{r.reason}</dd></>)}
              </dl>
              <Table>
                <TableHeader><TableRow><TableHead>Hàng</TableHead><TableHead className="text-right">SL</TableHead><TableHead>Lý do</TableHead><TableHead className="text-right">Hoàn</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.sales_return_items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.product_name}<div className="text-xs text-muted-foreground">{i.product_sku}{i.restock ? '' : ' · hàng hỏng, không nhập kho'}</div></TableCell>
                      <TableCell className="text-right">{i.quantity}</TableCell>
                      <TableCell>{REASON_LABELS[i.reason_code]}{i.reason_note ? ` · ${i.reason_note}` : ''}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(money(i.line_refund))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between font-medium"><dt>Giá trị hàng trả</dt><dd className="tabular-nums">{formatCurrency(money(r.goods_amount))}</dd></div>
                {money(r.receivable_reduction) > 0 && <div className="flex justify-between"><dt>Trừ công nợ</dt><dd className="tabular-nums">{formatCurrency(money(r.receivable_reduction))}</dd></div>}
                {r.sales_return_refunds.map((f) => (
                  <div key={f.id} className="flex justify-between"><dt>{REFUND_METHOD_LABELS[f.method]}{f.cash_book_accounts ? ` · ${f.cash_book_accounts.name}` : ''}</dt><dd className="tabular-nums">{formatCurrency(money(f.amount))}</dd></div>
                ))}
                {r.cash_book_entries.length > 0 && <div className="text-xs text-muted-foreground">Sổ quỹ: {r.cash_book_entries.map((e) => e.entry_number).join(', ')}</div>}
                {(r.points_reversed > 0 || r.points_restored > 0) && <div className="text-xs text-muted-foreground">Điểm thưởng: −{r.points_reversed} thu hồi, +{r.points_restored} hoàn</div>}
              </dl>
              <div className="hidden"><ReturnReceipt ref={ref} ret={r} /></div>
            </>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button disabled={!r} onClick={() => ref.current && printElement(ref.current, { title: r?.return_number, paperSize: '80mm' }).catch((e: Error) => toast.error(e.message))}><Printer className="h-4 w-4" /> In phiếu</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
