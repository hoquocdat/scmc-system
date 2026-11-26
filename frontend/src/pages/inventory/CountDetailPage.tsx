import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiCards } from '@/components/reports/KpiCards';
import { stockError, stockOpsApi } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, formatCurrency } from '@/lib/utils';

/** One count: scan or type counted quantities, review differences, complete. */
export function CountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const key = ['stock-counts', id];
  const { data: c, isLoading } = useQuery({ queryKey: key, queryFn: () => stockOpsApi.count(id!), enabled: !!id });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const onError = (e: unknown) => toast.error(stockError(e));
  const enter = useMutation({ mutationFn: (dto: { item_id?: string; code?: string; quantity?: number; increment?: number }) => stockOpsApi.enterCount(id!, dto), onSuccess: refresh, onError });
  const complete = useMutation({ mutationFn: () => stockOpsApi.completeCount(id!), onSuccess: () => { toast.success('Đã cân bằng tồn kho'); refresh(); }, onError });
  const cancel = useMutation({ mutationFn: () => stockOpsApi.cancelCount(id!), onSuccess: refresh, onError });

  if (isLoading || !c || !c.items || !c.summary) return <Skeleton className="h-64 w-full" />;
  const open = c.status === 'counting';
  const rows = onlyDiff ? c.items.filter((i) => i.difference) : c.items;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Về danh sách"><Link to="/inventory/counts"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div><h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">{c.count_number} <Badge variant="secondary">{open ? 'Đang kiểm' : c.status === 'completed' ? 'Đã cân bằng' : 'Đã hủy'}</Badge></h1><p className="text-sm text-muted-foreground">{c.stock_locations.name}</p></div>
        </div>
        {open && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Hủy phiếu</Button>
            {can('inventory', 'approve_count') && <Button onClick={() => setConfirm(true)}><CheckCheck className="h-4 w-4" /> Cân bằng kho</Button>}
          </div>
        )}
      </div>
      <KpiCards items={[
        { label: 'Đã đếm', value: `${c.summary.counted} / ${c.summary.items}` },
        { label: 'Thừa', value: `+${c.summary.surplus}` },
        { label: 'Thiếu', value: `−${c.summary.shortage}` },
        { label: 'Giá trị chênh lệch', value: formatCurrency(c.summary.value) },
      ]} />
      {open && can('inventory', 'count') && (
        <form className="flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) { enter.mutate({ code: code.trim(), increment: 1 }); setCode(''); scanRef.current?.focus(); } }}>
          <div className="relative flex-1">
            <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input ref={scanRef} autoFocus className="pl-8" placeholder="Quét mã vạch hoặc nhập SKU rồi Enter (+1)" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Quét mã" />
          </div>
          <Button type="submit" variant="outline" disabled={!code.trim()}>+1</Button>
        </form>
      )}
      <Label className="flex items-center gap-2 font-normal"><Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />Chỉ hiện mặt hàng lệch</Label>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Hàng hóa</TableHead><TableHead className="text-right">Tồn hệ thống</TableHead><TableHead className="w-28">Thực tế</TableHead><TableHead className="text-right">Lệch</TableHead><TableHead className="text-right">Giá trị lệch</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.name}<div className="font-mono text-xs text-muted-foreground">{i.sku}{i.barcode ? ` · ${i.barcode}` : ''}</div></TableCell>
                <TableCell className="text-right tabular-nums">{i.system_at_count ?? i.system_quantity}</TableCell>
                <TableCell>
                  {open ? (
                    <Input type="number" min={0} className="h-8" aria-label={`Thực tế ${i.name}`} defaultValue={i.counted_quantity ?? ''} key={`${i.id}-${i.counted_quantity}`}
                      onBlur={(e) => { const v = e.target.value; if (v !== '' && Number(v) !== i.counted_quantity) enter.mutate({ item_id: i.id, quantity: Math.max(0, Math.floor(Number(v))) }); }} />
                  ) : (i.counted_quantity ?? '—')}
                </TableCell>
                <TableCell className={cn('text-right tabular-nums', (i.difference ?? 0) < 0 && 'text-red-700', (i.difference ?? 0) > 0 && 'text-emerald-700')}>{i.difference == null ? '' : i.difference > 0 ? `+${i.difference}` : i.difference}</TableCell>
                <TableCell className="text-right tabular-nums">{i.difference_value ? formatCurrency(i.difference_value) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cân bằng kho theo phiếu kiểm?</AlertDialogTitle>
            <AlertDialogDescription>Hệ thống điều chỉnh {c.summary.surplus + c.summary.shortage} đơn vị ({formatCurrency(c.summary.value)}). Mặt hàng chưa đếm giữ nguyên.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => complete.mutate()}>Cân bằng</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
