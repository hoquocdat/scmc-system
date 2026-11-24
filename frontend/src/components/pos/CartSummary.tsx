import { useQuery } from '@tanstack/react-query';
import { Gift, Tag, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { loyaltyApi } from '@/lib/api/loyalty';
import { formatCurrency } from '@/lib/utils';
import type { Cart, CartTotals } from '@/hooks/usePosCarts';
import { PriceBookPicker } from '@/components/price-books/PriceBookPicker';
import { VoucherField } from '@/components/promotions/VoucherField';
import { promotionError } from '@/lib/api/promotions';

interface CartSummaryProps {
  cart: Cart;
  totals: CartTotals;
  onOpenCustomer: () => void;
  onClearCustomer: () => void;
  onOrderDiscount: (d: Cart['order_discount']) => void;
  onPoints: (points: number) => void;
  onPay: () => void;
  storeId?: string | null;
  onPriceBook: (priceBookId: string | null) => void;
  onVoucher: (code: string | null) => void;
  /** Server is re-pricing the cart. */
  pricing?: boolean;
  pricingError?: unknown;
}

/** Customer, discounts, loyalty redemption and the amount due. */
export function CartSummary({ cart, totals, onOpenCustomer, onClearCustomer, onOrderDiscount, onPoints, onPay, storeId, onPriceBook, onVoucher, pricing, pricingError }: CartSummaryProps) {
  const customerId = cart.customer?.id;
  const preview = useQuery({
    queryKey: ['pos', 'loyalty-preview', customerId, totals.afterLines - totals.orderDiscount, cart.points_to_redeem],
    queryFn: () => loyaltyApi.calculateRedemption(customerId!, totals.afterLines - totals.orderDiscount, cart.points_to_redeem || 0),
    enabled: !!customerId && totals.afterLines > 0,
  });
  const loyaltyDiscount = totals.server ? totals.loyaltyDiscount : cart.points_to_redeem > 0 && preview.data ? cart.points_to_redeem * preview.data.redemptionRate : 0;
  const total = totals.server ? totals.total : Math.max(0, totals.afterLines - totals.orderDiscount - loyaltyDiscount);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" className="flex-1 justify-start" onClick={onOpenCustomer}>
          <User className="h-4 w-4" />
          {cart.customer ? `${cart.customer.full_name} · ${cart.customer.phone}` : cart.new_customer ? `${cart.new_customer.name} (mới)` : 'Khách lẻ · chọn khách (F4)'}
        </Button>
        {(cart.customer || cart.new_customer) && <Button variant="ghost" size="sm" onClick={onClearCustomer}>Bỏ</Button>}
      </div>
      <PriceBookPicker storeId={storeId} customerId={cart.customer?.id} value={cart.price_book_id} onChange={onPriceBook} className="w-full" />
      {cart.customer && preview.data && (
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="flex items-center gap-1"><Gift className="h-4 w-4" /> {preview.data.tierName} · {preview.data.pointsAvailable.toLocaleString('vi-VN')} điểm</span>
          <Popover>
            <PopoverTrigger asChild><Button variant="link" size="sm" className="h-auto p-0">Dùng điểm</Button></PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <Label htmlFor="points">Điểm sử dụng (tối đa {preview.data.maxRedeemablePoints})</Label>
              <Input id="points" type="number" min={0} max={preview.data.maxRedeemablePoints} className="mt-2" value={cart.points_to_redeem || ''}
                onChange={(e) => onPoints(Math.max(0, Math.min(preview.data!.maxRedeemablePoints, Math.floor(Number(e.target.value) || 0))))} />
              <p className="mt-1 text-xs text-muted-foreground">Tối thiểu {preview.data.minRedemptionPoints} điểm · 1 điểm = {formatCurrency(preview.data.redemptionRate)}</p>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="space-y-1 text-sm">
        <Row label={`Tạm tính (${totals.itemCount} sp)`} value={formatCurrency(totals.subtotal)} />
        {totals.lineDiscounts > 0 && <Row label="Giảm theo dòng" value={`-${formatCurrency(totals.lineDiscounts)}`} muted />}
        {totals.promotions.map((p) => <Row key={p.id} label={`KM: ${p.name}`} value={`-${formatCurrency(p.amount)}`} muted />)}
        <div className="flex items-center justify-between">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-left hover:underline">
                <Tag className="h-3.5 w-3.5" /> Giảm giá đơn
                {cart.order_discount && <Badge variant="outline" className="px-1">{cart.order_discount.type === 'percent' ? `${cart.order_discount.value}%` : formatCurrency(cart.order_discount.value)}</Badge>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                {cart.order_discount?.type === 'percent' ? (
                  <Input type="number" min={0} max={100} value={cart.order_discount.value} onChange={(e) => onOrderDiscount({ type: 'percent', value: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                ) : (
                  <CurrencyInput value={cart.order_discount?.value ?? 0} onValueChange={(v) => onOrderDiscount(v ? { type: 'fixed', value: v } : null)} />
                )}
                <Select value={cart.order_discount?.type ?? 'fixed'} onValueChange={(t) => onOrderDiscount({ type: t as 'fixed' | 'percent', value: 0 })}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">VND</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => onOrderDiscount(null)}>Bỏ giảm giá</Button>
            </PopoverContent>
          </Popover>
          <span className="tabular-nums">{totals.orderDiscount > 0 ? `-${formatCurrency(totals.orderDiscount)}` : '—'}</span>
        </div>
        <VoucherField code={cart.voucher_code ?? null} result={totals.voucher} onApply={onVoucher} />
        {loyaltyDiscount > 0 && <Row label={`Điểm thưởng (${cart.points_to_redeem} điểm)`} value={`-${formatCurrency(loyaltyDiscount)}`} muted />}
        {pricingError != null && <p className="text-xs text-destructive">{promotionError(pricingError).message}</p>}
        <Separator className="my-2" />
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold">Khách cần trả</span>
          <span className={`text-2xl font-bold tabular-nums text-primary ${pricing ? 'opacity-60' : ''}`}>{formatCurrency(total)}</span>
        </div>
      </div>

      <Button className="w-full" size="lg" disabled={cart.lines.length === 0} onClick={onPay}>
        Thanh toán (F9)
      </Button>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
