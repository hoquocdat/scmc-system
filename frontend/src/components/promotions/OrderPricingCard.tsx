import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { promotionError, type CartBreakdown } from '@/lib/api/promotions';
import { formatCurrency } from '@/lib/utils';
import { VoucherField } from './VoucherField';

interface Props {
  breakdown?: CartBreakdown;
  loading?: boolean;
  error?: unknown;
  voucherCode: string | null;
  onVoucher: (code: string | null) => void;
}

/** Promotions, voucher and the total exactly as the server will charge it. */
export function OrderPricingCard({ breakdown: b, loading, error, voucherCode, onVoucher }: Props) {
  const row = (label: string, value: number, strong = false) => (
    <div key={label} className={`flex justify-between ${strong ? 'text-base font-semibold' : 'text-muted-foreground'}`}>
      <span>{label}</span><span className="tabular-nums">{value < 0 ? `-${formatCurrency(-value)}` : formatCurrency(value)}</span>
    </div>
  );
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Khuyến mãi và voucher</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <VoucherField code={voucherCode} result={b?.voucher ?? null} onApply={onVoucher} />
        {error != null && <p className="text-xs text-destructive">{promotionError(error).message}</p>}
        {!b && loading && <Skeleton className="h-16 w-full" />}
        {b && (
          <>
            {b.promotions.length === 0 && <p className="text-muted-foreground">Không có khuyến mãi áp dụng</p>}
            {b.promotions.map((p) => row(`KM: ${p.name}`, -p.amount))}
            {b.voucher?.ok && row(`Voucher ${b.voucher.code}`, -b.voucher_discount)}
            {b.loyalty_discount > 0 && row('Điểm thưởng', -b.loyalty_discount)}
            <Separator />
            {row('Tổng thanh toán (theo hệ thống)', b.total, true)}
          </>
        )}
      </CardContent>
    </Card>
  );
}
