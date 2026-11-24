import { AlertTriangle, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { CartLine } from '@/hooks/usePosCarts';

interface CartLinesProps {
  lines: CartLine[];
  onQuantity: (key: string, quantity: number) => void;
  onLineDiscount: (key: string, discount: number) => void;
}

export function CartLines({ lines, onQuantity, onLineDiscount }: CartLinesProps) {
  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <ShoppingCart className="mb-3 h-12 w-12" />
        <p>Giỏ hàng trống</p>
        <p className="text-sm">Chọn hoặc quét sản phẩm để bắt đầu</p>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {lines.map((line) => (
        <li key={line.key} className={`py-3 ${line.shortage !== undefined ? 'rounded-md bg-destructive/10 px-2' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{line.name}</div>
              <div className="text-xs text-muted-foreground">
                {line.sku}
                {line.stock !== null && <> · tồn {line.stock}</>}
              </div>
              {line.price_book_name && (
                <Badge variant="secondary" className="mt-1 px-1.5 text-[11px]" title={line.base_price != null ? `Giá chung ${formatCurrency(line.base_price)}` : undefined}>
                  {line.price_book_name}
                </Badge>
              )}
              {line.shortage !== undefined && (
                <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Không đủ tồn kho (còn {line.shortage})
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Xóa dòng" onClick={() => onQuantity(line.key, 0)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Giảm" onClick={() => onQuantity(line.key, line.quantity - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1}
                className="h-8 w-14 text-center"
                value={line.quantity}
                onChange={(e) => onQuantity(line.key, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Tăng" onClick={() => onQuantity(line.key, line.quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums">{formatCurrency((line.unit_price - line.discount_amount) * line.quantity)}</div>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                    {formatCurrency(line.unit_price)} / sp
                    {line.discount_amount > 0 && <Badge variant="outline" className="ml-1 px-1">-{formatCurrency(line.discount_amount)}</Badge>}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-60" align="end">
                  <Label htmlFor={`disc-${line.key}`}>Giảm giá mỗi sản phẩm (VND)</Label>
                  <CurrencyInput
                    id={`disc-${line.key}`}
                    className="mt-2"
                    value={line.discount_amount}
                    onValueChange={(v) => onLineDiscount(line.key, Math.min(line.unit_price, Math.max(0, v ?? 0)))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
