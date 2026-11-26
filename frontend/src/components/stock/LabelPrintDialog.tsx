import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { printElement } from '@/lib/utils/print';
import { BarcodeSvg } from './BarcodeSvg';

export interface LabelItem {
  key: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  quantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LabelItem[];
}

type Layout = 'roll' | 'a4';

/** Barcode labels (name, price, barcode) for a list of items, on a 50×30 mm roll or A4 3×8. */
export function LabelPrintDialog({ open, onOpenChange, items }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>('roll');
  const [qty, setQty] = useState<Record<string, number>>({});
  useEffect(() => { if (open) setQty(Object.fromEntries(items.map((i) => [i.key, i.quantity]))); }, [open, items]);
  const labels = items.flatMap((i) => Array.from({ length: qty[i.key] ?? 0 }, (_, n) => ({ ...i, n })));
  const missing = items.filter((i) => !i.barcode).length;

  const print = () =>
    ref.current && printElement(ref.current, { title: 'Tem mã vạch', paperSize: layout === 'a4' ? 'A4' : '80mm' }).catch((e: Error) => toast.error(e.message));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>In tem mã vạch</DialogTitle>
          <DialogDescription>{missing > 0 ? `${missing} mặt hàng chưa có mã vạch sẽ in theo SKU.` : 'Kiểm tra số tem rồi in.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <ScrollArea className="max-h-[50vh] rounded-md border">
            <div ref={ref} className={layout === 'a4' ? 'grid grid-cols-3 gap-1 bg-white p-2' : 'flex flex-col items-center gap-1 bg-white p-1'}>
              {labels.map((l) => (
                <div key={`${l.key}-${l.n}`} className="flex h-[30mm] w-[50mm] flex-col items-center justify-center overflow-hidden border border-dashed border-gray-300 px-1 text-center text-black" style={{ breakInside: 'avoid' }}>
                  <div className="line-clamp-2 text-[10px] leading-tight">{l.name}</div>
                  <div className="text-[11px] font-bold">{formatCurrency(l.price)}</div>
                  <BarcodeSvg value={l.barcode ?? l.sku} height={28} width={1.2} />
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Khổ giấy</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="roll">Cuộn 50×30 mm</SelectItem><SelectItem value="a4">A4 (3 × 8 tem)</SelectItem></SelectContent>
              </Select>
            </div>
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2 pr-2">
                {items.map((i) => (
                  <div key={i.key} className="grid grid-cols-[1fr_4.5rem] items-center gap-2 text-sm">
                    <span className="truncate" title={i.name}>{i.name}</span>
                    <Input type="number" min={0} className="h-8" aria-label={`Số tem ${i.name}`} value={qty[i.key] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button disabled={!labels.length} onClick={() => void print()}><Printer className="h-4 w-4" /> In {labels.length} tem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
