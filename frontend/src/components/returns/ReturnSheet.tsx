import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { REFUND_METHOD_LABELS, returnError, salesReturnsApi, type RefundInput, type RefundMethod, type ReturnRequest, type SalesReturn } from '@/lib/api/sales-returns';
import { formatCurrency } from '@/lib/utils';
import { ExchangeLines, type ExchangeLine } from './ExchangeLines';
import { RefundRows } from './RefundRows';
import { emptyChoice, type LineChoice } from './return-choice';
import { ReturnLinesTable } from './ReturnLinesTable';
import { ReturnSummary } from './ReturnSummary';

interface ReturnSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start from this order (number or id); otherwise staff type it. */
  orderCode?: string;
  onDone: (ret: SalesReturn) => void;
}

/** Return or exchange items of one order (spec sales/returns). */
export function ReturnSheet({ open, onOpenChange, orderCode, onDone }: ReturnSheetProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [choices, setChoices] = useState<Record<string, LineChoice>>({});
  const [mode, setMode] = useState<'return' | 'exchange'>('return');
  const [exchange, setExchange] = useState<ExchangeLine[]>([]);
  const [payMethod, setPayMethod] = useState<RefundMethod>('cash');
  const [refunds, setRefunds] = useState<RefundInput[]>([]);
  const [refundsEdited, setRefundsEdited] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode(orderCode ?? ''); setSubmitted(orderCode ?? ''); setChoices({}); setMode('return');
    setExchange([]); setRefunds([]); setRefundsEdited(false); setReason('');
  }, [open, orderCode]);

  const lookup = useQuery({ queryKey: ['sales-returns', 'lookup', submitted], queryFn: () => salesReturnsApi.lookup(submitted), enabled: open && !!submitted, retry: false });
  const order = lookup.data;

  const request = useMemo<ReturnRequest | null>(() => {
    if (!order) return null;
    const items = Object.entries(choices).filter(([, c]) => c.quantity > 0).map(([id, c]) => ({ sales_order_item_id: id, quantity: c.quantity, reason_code: c.reason, restock: c.restock }));
    if (!items.length) return null;
    const lines = mode === 'exchange' ? exchange.map((l) => ({ product_id: l.product_id, product_variant_id: l.product_variant_id, quantity: l.quantity })) : [];
    return { sales_order_id: order.id, items, exchange: lines.length ? { lines } : undefined, reason: reason || undefined };
  }, [order, choices, mode, exchange, reason]);

  const preview = useQuery({ queryKey: ['sales-returns', 'preview', request], queryFn: () => salesReturnsApi.preview(request!), enabled: !!request, placeholderData: keepPreviousData, retry: false });
  const p = request ? preview.data : undefined;
  const due = p?.refund_after_exchange ?? 0;

  // Default refund: everything back by cash, until staff change it
  useEffect(() => {
    if (!refundsEdited) setRefunds(due > 0 ? [{ method: 'cash', amount: due }] : []);
  }, [due, refundsEdited]);

  const create = useMutation({
    mutationFn: () => {
      const priced = p?.exchange_lines ?? [];
      return salesReturnsApi.create({
        ...request!,
        refunds,
        exchange: request!.exchange && {
          lines: request!.exchange.lines.map((l) => ({ ...l, expected_unit_price: priced.find((x) => x.product_id === l.product_id && (x.product_variant_id ?? undefined) === l.product_variant_id)?.unit_price })),
          payments: p && p.customer_pays > 0 ? [{ method: payMethod, amount: p.customer_pays, amount_tendered: payMethod === 'cash' ? p.customer_pays : undefined }] : undefined,
        },
      });
    },
    onSuccess: (ret) => {
      for (const key of [['sales-returns'], ['pos'], ['cash-book'], ['customers'], ['sales-orders'], ['pricing']]) void queryClient.invalidateQueries({ queryKey: key });
      onOpenChange(false);
      onDone(ret);
    },
    onError: (e) => toast.error(returnError(e).message),
  });

  const sum = refunds.reduce((s, r) => s + (r.amount || 0), 0);
  const blocked = !p || Math.abs(sum - due) > 0.5 || (p.needs_approval && !p.can_approve) || create.isPending || (mode === 'exchange' && !exchange.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="px-6">
          <SheetTitle>Trả hàng / đổi hàng</SheetTitle>
          <SheetDescription>Nhập số đơn trên hóa đơn của khách. Tiền hoàn bằng đúng số khách đã trả cho các món trả lại.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(code.trim()); setChoices({}); }}>
            <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Số đơn hàng (VD: SO-2611-00012)" aria-label="Số đơn hàng" />
            <Button type="submit" variant="outline" disabled={!code.trim()}><Search className="h-4 w-4" /> Tìm</Button>
          </form>
          {lookup.isLoading && <Skeleton className="h-32 w-full" />}
          {lookup.error && <Alert variant="destructive"><AlertDescription>{returnError(lookup.error).message}</AlertDescription></Alert>}
          {order && (
            <>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span><span className="font-medium">{order.order_number}</span> · {order.customer?.full_name ?? order.customer_name} · {order.store_name}</span>
                <span className="text-muted-foreground">Tổng {formatCurrency(order.total_amount)} · đã thu {formatCurrency(order.paid_amount)}{order.receivable_balance > 0 ? ` · còn nợ ${formatCurrency(order.receivable_balance)}` : ''}</span>
              </div>
              {!order.returnable && <Alert variant="destructive"><AlertDescription>{order.blocked_reason}</AlertDescription></Alert>}
              <ReturnLinesTable lines={order.lines} choices={choices} onChange={(id, c) => setChoices((s) => ({ ...s, [id]: c ?? emptyChoice }))} />
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'return' | 'exchange')}>
                <TabsList><TabsTrigger value="return">Trả hàng, hoàn tiền</TabsTrigger><TabsTrigger value="exchange">Đổi sang hàng khác</TabsTrigger></TabsList>
              </Tabs>
              {mode === 'exchange' && <ExchangeLines lines={exchange} onChange={setExchange} priced={p?.exchange_lines} />}
              {preview.error && <Alert variant="destructive"><AlertDescription>{returnError(preview.error).message}</AlertDescription></Alert>}
              <ReturnSummary preview={p} loading={preview.isFetching} />
              {p && p.customer_pays > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">Khách trả thêm {formatCurrency(p.customer_pays)} bằng</Label>
                  <Select value={payMethod} onValueChange={(m) => setPayMethod(m as RefundMethod)}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>{(['cash', 'card', 'bank_transfer', 'ewallet_momo', 'ewallet_zalopay', 'ewallet_vnpay'] as RefundMethod[]).map((m) => <SelectItem key={m} value={m}>{REFUND_METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {due > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Hoàn tiền</Label>
                    <RefundRows rows={refunds} onChange={(r) => { setRefunds(r); setRefundsEdited(true); }} due={due} storeId={order.store_id} hasCustomer={!!order.customer} />
                  </div>
                </>
              )}
              <div className="space-y-2"><Label htmlFor="ret-reason">Ghi chú</Label><Textarea id="ret-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            </>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={blocked} onClick={() => create.mutate()}>{create.isPending ? 'Đang ghi…' : mode === 'exchange' ? 'Xác nhận đổi hàng' : 'Xác nhận trả hàng'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
