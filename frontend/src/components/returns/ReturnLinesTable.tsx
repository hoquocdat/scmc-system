import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { REASON_LABELS, type ReturnableLine, type ReturnReason } from '@/lib/api/sales-returns';
import { emptyChoice, type LineChoice } from './return-choice';
import { formatCurrency } from '@/lib/utils';

interface Props {
  lines: ReturnableLine[];
  choices: Record<string, LineChoice>;
  onChange: (lineId: string, choice: LineChoice) => void;
}

/** Order lines with how many to return, why, and whether they go back into stock. */
export function ReturnLinesTable({ lines, choices, onChange }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hàng hóa</TableHead>
            <TableHead className="text-right">Đã mua / đã trả</TableHead>
            <TableHead className="text-right">Hoàn / sp</TableHead>
            <TableHead className="w-24">Trả</TableHead>
            <TableHead>Lý do</TableHead>
            <TableHead>Nhập kho</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l) => {
            const c = choices[l.id] ?? emptyChoice;
            const set = (patch: Partial<LineChoice>) => onChange(l.id, { ...c, ...patch });
            return (
              <TableRow key={l.id} className={l.remaining === 0 ? 'text-muted-foreground' : undefined}>
                <TableCell>
                  <div className="font-medium">{l.product_name}</div>
                  <div className="text-xs text-muted-foreground">{l.product_sku}{l.variant_name ? ` · ${l.variant_name}` : ''} · {formatCurrency(l.unit_price)}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.quantity} / {l.returned_quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(l.unit_refund)}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={l.remaining}
                    disabled={l.remaining === 0}
                    aria-label={`Số lượng trả ${l.product_name}`}
                    className="h-8 w-20"
                    value={c.quantity || ''}
                    onChange={(e) => set({ quantity: Math.max(0, Math.min(l.remaining, Math.floor(Number(e.target.value) || 0))) })}
                  />
                </TableCell>
                <TableCell>
                  <Select value={c.reason} onValueChange={(v) => set({ reason: v as ReturnReason })} disabled={!c.quantity}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={c.restock} disabled={!c.quantity} onCheckedChange={(v) => set({ restock: v === true })} />
                    {c.restock ? 'Bán lại được' : 'Hàng hỏng'}
                  </label>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
