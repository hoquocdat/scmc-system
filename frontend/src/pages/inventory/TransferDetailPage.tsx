import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, PackageCheck, Printer, Truck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LabelPrintDialog } from '@/components/stock/LabelPrintDialog';
import { stockError, stockOpsApi, TRANSFER_STATUS_LABELS } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime } from '@/lib/utils';

/** One transfer: ship (from the source), receive (at the destination, partly or fully), cancel. */
export function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { data: t, isLoading } = useQuery({ queryKey: ['stock-transfers', id], queryFn: () => stockOpsApi.transfer(id!), enabled: !!id });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [close, setClose] = useState(false);
  const [reason, setReason] = useState('');
  const [labels, setLabels] = useState(false);
  const shipping = t?.status === 'pending';
  const receiving = t?.status === 'in_transit' || t?.status === 'partially_received';

  useEffect(() => {
    if (!t) return;
    setQty(Object.fromEntries(t.items.map((i) => [i.id, shipping ? i.quantity_requested : Math.max(0, i.quantity_shipped - i.quantity_received)])));
  }, [t, shipping]);

  const done = (msg: string) => () => { toast.success(msg); void queryClient.invalidateQueries({ queryKey: ['stock-transfers'] }); };
  const onError = (e: unknown) => toast.error(stockError(e));
  const lines = () => Object.entries(qty).map(([item_id, quantity]) => ({ item_id, quantity }));
  const ship = useMutation({ mutationFn: () => stockOpsApi.ship(id!, lines()), onSuccess: done('Đã xuất kho'), onError });
  const receive = useMutation({ mutationFn: () => stockOpsApi.receive(id!, lines(), close), onSuccess: done('Đã nhận hàng'), onError });
  const cancel = useMutation({ mutationFn: () => stockOpsApi.cancelTransfer(id!, reason), onSuccess: done('Đã hủy phiếu'), onError });

  if (isLoading || !t) return <Skeleton className="h-64 w-full" />;
  const canAct = can('inventory', 'transfer');
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Về danh sách"><Link to="/inventory/transfers"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">{t.transfer_number} <Badge variant="secondary">{TRANSFER_STATUS_LABELS[t.status]}</Badge></h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">{t.from.name} <ArrowRight className="h-3 w-3" /> {t.to.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('inventory', 'labels') && <Button variant="outline" onClick={() => setLabels(true)}><Printer className="h-4 w-4" /> In tem</Button>}
          {canAct && shipping && <Button disabled={ship.isPending} onClick={() => ship.mutate()}><Truck className="h-4 w-4" /> Xuất kho</Button>}
          {canAct && receiving && <Button disabled={receive.isPending} onClick={() => receive.mutate()}><PackageCheck className="h-4 w-4" /> Nhận hàng</Button>}
        </div>
      </div>
      <Card><CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-3">
        <div><div className="text-xs text-muted-foreground">Tạo</div>{t.requested_by ?? '—'} · {formatDateTime(t.created_at)}</div>
        <div><div className="text-xs text-muted-foreground">Xuất</div>{t.shipped_date ? `${t.shipped_by ?? ''} · ${formatDateTime(t.shipped_date)}` : '—'}</div>
        <div><div className="text-xs text-muted-foreground">Nhận</div>{t.received_date ? `${t.received_by ?? ''} · ${formatDateTime(t.received_date)}` : '—'}</div>
        {t.notes && <div className="sm:col-span-3"><div className="text-xs text-muted-foreground">Ghi chú</div>{t.notes}</div>}
        {t.cancel_reason && <div className="text-destructive sm:col-span-3">Đã hủy: {t.cancel_reason}</div>}
      </CardContent></Card>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Hàng hóa</TableHead><TableHead className="text-right">Yêu cầu</TableHead><TableHead className="text-right">Đã xuất</TableHead><TableHead className="text-right">Đã nhận</TableHead><TableHead className="text-right">Thiếu</TableHead>
            {(shipping || receiving) && canAct && <TableHead className="w-28">{shipping ? 'Xuất' : 'Nhận thêm'}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {t.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.name}<div className="font-mono text-xs text-muted-foreground">{i.sku}</div></TableCell>
                <TableCell className="text-right tabular-nums">{i.quantity_requested}</TableCell>
                <TableCell className="text-right tabular-nums">{i.quantity_shipped}</TableCell>
                <TableCell className="text-right tabular-nums">{i.quantity_received}</TableCell>
                <TableCell className="text-right tabular-nums">{i.quantity_discrepancy || ''}</TableCell>
                {(shipping || receiving) && canAct && (
                  <TableCell><Input type="number" min={0} className="h-8" aria-label={`Số lượng ${i.name}`} value={qty[i.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} /></TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canAct && receiving && (
        <Label className="flex items-center gap-2 font-normal"><Checkbox checked={close} onCheckedChange={(v) => setClose(v === true)} />Kết thúc phiếu: phần chưa nhận được ghi là thiếu hụt</Label>
      )}
      {canAct && (shipping || receiving) && (
        <div className="flex max-w-xl items-end gap-2">
          <div className="flex-1 space-y-2"><Label htmlFor="tr-cancel">Lý do hủy</Label><Input id="tr-cancel" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={receiving ? 'Hàng chưa nhận sẽ trả về kho đi' : ''} /></div>
          <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}><XCircle className="h-4 w-4" /> Hủy phiếu</Button>
        </div>
      )}
      <LabelPrintDialog open={labels} onOpenChange={setLabels} items={t.items.map((i) => ({ key: i.id, name: i.name, sku: i.sku, barcode: i.barcode, price: i.price, quantity: i.quantity_shipped || i.quantity_requested }))} />
    </div>
  );
}
