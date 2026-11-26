import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductSearchInput } from '@/components/inventory/purchase-orders/ProductSearchInput';

export interface EditorLine {
  key: string;
  product_id?: string;
  product_variant_id?: string;
  name: string;
  sku: string;
  quantity: number;
}

interface Props {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
}

/** Product search (scan-friendly) plus a quantity per line; adding the same item again adds 1. */
export function StockLinesEditor({ lines, onChange }: Props) {
  const add = (p: { id: string; name: string; sku?: string }, v?: { id: string; name: string; sku?: string }) => {
    const key = `${p.id}:${v?.id ?? ''}`;
    if (lines.some((l) => l.key === key)) return onChange(lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)));
    onChange([...lines, { key, product_id: v ? undefined : p.id, product_variant_id: v?.id, name: v ? `${p.name} / ${v.name}` : p.name, sku: v?.sku ?? p.sku ?? '', quantity: 1 }]);
  };
  return (
    <div className="space-y-2">
      <ProductSearchInput onProductSelect={add} placeholder="Tìm hoặc quét mã sản phẩm…" />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Hàng hóa</TableHead><TableHead className="w-28">Số lượng</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {lines.length === 0 && <TableRow><TableCell colSpan={3} className="h-16 text-center text-muted-foreground">Chưa có mặt hàng</TableCell></TableRow>}
            {lines.map((l) => (
              <TableRow key={l.key}>
                <TableCell>{l.name}<div className="font-mono text-xs text-muted-foreground">{l.sku}</div></TableCell>
                <TableCell><Input type="number" min={1} className="h-8" aria-label={`Số lượng ${l.name}`} value={l.quantity} onChange={(e) => onChange(lines.map((x) => (x.key === l.key ? { ...x, quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)))} /></TableCell>
                <TableCell><Button size="icon" variant="ghost" aria-label="Bỏ" onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
