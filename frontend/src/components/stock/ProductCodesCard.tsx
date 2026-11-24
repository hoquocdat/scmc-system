import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Barcode, Plus, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { stockError, stockOpsApi } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';
import { BarcodeSvg } from './BarcodeSvg';
import { LabelPrintDialog } from './LabelPrintDialog';

interface Props {
  productId: string;
  name: string;
  sku: string;
  price: number;
  barcode: string | null | undefined;
}

/** A product's barcode (entered or generated), base unit and selling/buying units, plus label printing. */
export function ProductCodesCard({ productId, name, sku, price, barcode }: Props) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can('products', 'update');
  const [code, setCode] = useState(barcode ?? '');
  const [unit, setUnit] = useState<{ name: string; factor: number; price?: number; barcode: string }>({ name: '', factor: 10, barcode: '' });
  const [labels, setLabels] = useState(false);
  const { data: units } = useQuery({ queryKey: ['product-units', productId], queryFn: () => stockOpsApi.units(productId) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['product', productId] }); void queryClient.invalidateQueries({ queryKey: ['product-units', productId] }); };
  const onError = (e: unknown) => toast.error(stockError(e));
  const save = useMutation({ mutationFn: () => stockOpsApi.setBarcode('product', productId, code.trim() || null), onSuccess: () => { toast.success('Đã lưu mã vạch'); refresh(); }, onError });
  const gen = useMutation({ mutationFn: () => stockOpsApi.generateBarcode('product', productId), onSuccess: (r) => { setCode(r.barcode); toast.success('Đã tạo mã vạch'); refresh(); }, onError });
  const base = useMutation({ mutationFn: (b: string) => stockOpsApi.setBaseUnit(productId, b), onSuccess: refresh, onError });
  const add = useMutation({ mutationFn: () => stockOpsApi.addUnit(productId, { name: unit.name.trim(), factor: unit.factor, price: unit.price ?? null, barcode: unit.barcode.trim() || null }), onSuccess: () => { setUnit({ name: '', factor: 10, barcode: '' }); refresh(); }, onError });
  const remove = useMutation({ mutationFn: (unitId: string) => stockOpsApi.removeUnit(productId, unitId), onSuccess: refresh, onError });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Barcode className="h-5 w-5" /> Mã vạch và đơn vị tính</CardTitle>
        <CardDescription>Quét được ở POS, kiểm kho, chuyển kho và nhận hàng. Tồn kho luôn tính theo đơn vị cơ bản.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1 space-y-2"><Label htmlFor="pc-barcode">Mã vạch</Label><Input id="pc-barcode" value={code} disabled={!canEdit} onChange={(e) => setCode(e.target.value)} placeholder="Quét hoặc nhập" /></div>
          {canEdit && <Button variant="outline" disabled={save.isPending || code === (barcode ?? '')} onClick={() => save.mutate()}>Lưu</Button>}
          {canEdit && !barcode && <Button variant="outline" disabled={gen.isPending} onClick={() => gen.mutate()}>Tạo mã EAN-13</Button>}
          {can('inventory', 'labels') && <Button variant="outline" onClick={() => setLabels(true)}><Printer className="h-4 w-4" /> In tem</Button>}
        </div>
        {barcode && <div className="rounded-md border bg-white p-2"><BarcodeSvg value={barcode} /></div>}
        <div className="grid grid-cols-[10rem_1fr] items-center gap-3">
          <Label htmlFor="pc-base">Đơn vị cơ bản</Label>
          <Input id="pc-base" className="max-w-40" defaultValue={units?.base_unit ?? 'cái'} key={units?.base_unit} disabled={!canEdit} onBlur={(e) => e.target.value.trim() && e.target.value !== units?.base_unit && base.mutate(e.target.value.trim())} />
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Đơn vị</TableHead><TableHead className="text-right">Quy đổi</TableHead><TableHead className="text-right">Giá bán</TableHead><TableHead>Mã vạch</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {units?.units.map((u) => (
              <TableRow key={u.id} className={u.is_active ? '' : 'text-muted-foreground line-through'}>
                <TableCell>{u.name}</TableCell>
                <TableCell className="text-right tabular-nums">{u.factor} {units.base_unit}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(u.price ?? price * u.factor)}{u.price == null && <span className="text-xs text-muted-foreground"> (theo giá lẻ)</span>}</TableCell>
                <TableCell className="font-mono text-xs">{u.barcode}</TableCell>
                <TableCell>{canEdit && u.is_active && <Button size="icon" variant="ghost" aria-label="Bỏ đơn vị" onClick={() => remove.mutate(u.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
            {canEdit && (
              <TableRow>
                <TableCell><Input className="h-8" placeholder="hộp" aria-label="Tên đơn vị" value={unit.name} onChange={(e) => setUnit((x) => ({ ...x, name: e.target.value }))} /></TableCell>
                <TableCell><Input className="h-8 text-right" type="number" min={2} aria-label="Quy đổi" value={unit.factor} onChange={(e) => setUnit((x) => ({ ...x, factor: Math.max(2, Math.floor(Number(e.target.value) || 2)) }))} /></TableCell>
                <TableCell><CurrencyInput className="h-8" aria-label="Giá bán đơn vị" placeholder="Theo giá lẻ" value={unit.price} onValueChange={(v) => setUnit((x) => ({ ...x, price: v }))} /></TableCell>
                <TableCell><Input className="h-8" aria-label="Mã vạch đơn vị" value={unit.barcode} onChange={(e) => setUnit((x) => ({ ...x, barcode: e.target.value }))} /></TableCell>
                <TableCell><Button size="icon" variant="outline" aria-label="Thêm đơn vị" disabled={!unit.name.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <LabelPrintDialog open={labels} onOpenChange={setLabels} items={[{ key: productId, name, sku, barcode: barcode ?? null, price, quantity: 1 }]} />
    </Card>
  );
}
