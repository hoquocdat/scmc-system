import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LocationSelect } from '@/components/stock/LocationSelect';
import { stockError, stockOpsApi, type ReorderAlert } from '@/lib/api/stock-operations';
import { suppliersApi } from '@/lib/api/suppliers';
import { usePermissions } from '@/hooks/usePermissions';

const keyOf = (a: ReorderAlert) => `${a.location_id}:${a.product_id ?? ''}:${a.product_variant_id ?? ''}`;

/** Sắp hết hàng: items at or below their threshold per location; selected ones become a draft PO. */
export function ReorderAlertsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [location, setLocation] = useState<string>();
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [supplier, setSupplier] = useState<string>();
  const { data: alerts, isLoading } = useQuery({ queryKey: ['reorder-alerts', location ?? 'all'], queryFn: () => stockOpsApi.reorderAlerts(location) });
  const { data: supplierList = [] } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.getAll() });
  const createPo = useMutation({
    mutationFn: () => stockOpsApi.reorderPurchaseOrder({
      supplier_id: supplier!,
      items: (alerts ?? []).filter((a) => picked[keyOf(a)]).map((a) => ({ product_id: a.product_variant_id ? undefined : (a.product_id ?? undefined), product_variant_id: a.product_variant_id ?? undefined, quantity: picked[keyOf(a)] })),
    }),
    onSuccess: (po) => { toast.success(`Đã tạo đơn đặt hàng ${po.order_number}`); navigate(`/inventory/purchase-orders/${po.id}`); },
    onError: (e) => toast.error(stockError(e)),
  });
  const toggle = (a: ReorderAlert) => setPicked((p) => { const k = keyOf(a); const n = { ...p }; if (n[k]) delete n[k]; else n[k] = a.suggested; return n; });
  const count = Object.keys(picked).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-semibold sm:text-2xl">Sắp hết hàng</h1><p className="text-sm text-muted-foreground">Tồn khả dụng (tồn − đang giữ) ≤ ngưỡng (điểm đặt hàng lại hoặc tồn an toàn).</p></div>
        <div className="w-64"><LocationSelect value={location} onChange={setLocation} placeholder="Mọi kho" /></div>
      </div>
      {count > 0 && can('products', 'create') && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
          <span className="text-sm">Đã chọn {count} mặt hàng ·</span>
          <Select value={supplier ?? ''} onValueChange={setSupplier}><SelectTrigger className="w-64"><SelectValue placeholder="Nhà cung cấp" /></SelectTrigger><SelectContent>{supplierList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <Button disabled={!supplier || createPo.isPending} onClick={() => createPo.mutate()}><ShoppingBag className="h-4 w-4" /> Tạo đơn đặt hàng nháp</Button>
        </div>
      )}
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Hàng hóa</TableHead><TableHead>Kho</TableHead><TableHead className="text-right">Tồn / giữ / khả dụng</TableHead><TableHead className="text-right">Ngưỡng</TableHead><TableHead className="w-28">Đặt thêm</TableHead></TableRow></TableHeader>
            <TableBody>
              {alerts?.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Không có mặt hàng nào sắp hết</TableCell></TableRow>}
              {alerts?.map((a) => (
                <TableRow key={keyOf(a)}>
                  <TableCell><Checkbox checked={!!picked[keyOf(a)]} aria-label={`Chọn ${a.name}`} onCheckedChange={() => toggle(a)} /></TableCell>
                  <TableCell>{a.name}<div className="font-mono text-xs text-muted-foreground">{a.sku}</div></TableCell>
                  <TableCell>{a.location_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.on_hand} / {a.reserved} / <span className="font-semibold text-destructive">{a.available}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{a.threshold}</TableCell>
                  <TableCell><Input type="number" min={1} className="h-8" aria-label={`Số đặt ${a.name}`} value={picked[keyOf(a)] ?? a.suggested} onChange={(e) => setPicked((p) => ({ ...p, [keyOf(a)]: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
