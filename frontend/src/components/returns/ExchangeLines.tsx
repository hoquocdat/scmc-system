import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductSearchInput } from '@/components/inventory/purchase-orders/ProductSearchInput';
import type { ReturnPreview } from '@/lib/api/sales-returns';
import { formatCurrency } from '@/lib/utils';

export interface ExchangeLine {
  key: string;
  product_id: string;
  product_variant_id?: string;
  name: string;
  quantity: number;
}

interface Props {
  lines: ExchangeLine[];
  onChange: (lines: ExchangeLine[]) => void;
  /** Server prices of the replacement lines (from the preview). */
  priced?: ReturnPreview['exchange_lines'];
}

/** Replacement items of an exchange, priced by the server like any sale. */
export function ExchangeLines({ lines, onChange, priced = [] }: Props) {
  const add = (product: { id: string; name: string }, variant?: { id: string; name: string }) => {
    const key = `${product.id}:${variant?.id ?? ''}`;
    const existing = lines.find((l) => l.key === key);
    onChange(
      existing
        ? lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
        : [...lines, { key, product_id: product.id, product_variant_id: variant?.id, name: variant ? `${product.name} / ${variant.name}` : product.name, quantity: 1 }],
    );
  };
  const priceOf = (l: ExchangeLine) => priced.find((p) => p.product_id === l.product_id && (p.product_variant_id ?? undefined) === l.product_variant_id);

  return (
    <div className="space-y-2">
      <ProductSearchInput onProductSelect={add} placeholder="Thêm hàng đổi (tên hoặc SKU)…" />
      {lines.length > 0 && (
        <ul className="divide-y rounded-md border">
          {lines.map((l) => {
            const p = priceOf(l);
            return (
              <li key={l.key} className="flex items-center gap-2 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p ? formatCurrency(p.unit_price) : '…'} / sp
                    {p?.price_book_name && <Badge variant="secondary" className="ml-1 px-1 text-[11px]">{p.price_book_name}</Badge>}
                  </div>
                </div>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-16"
                  aria-label={`Số lượng ${l.name}`}
                  value={l.quantity}
                  onChange={(e) => onChange(lines.map((x) => (x.key === l.key ? { ...x, quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)))}
                />
                <span className="w-28 text-right tabular-nums">{p ? formatCurrency(p.line_total) : ''}</span>
                <Button variant="ghost" size="icon" aria-label="Bỏ" onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
