import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { type DiscountType } from '@/lib/api/sales';

interface SalesOrderTotalsCardProps {
  subtotal: number;
  discountType: DiscountType;
  discountPercent: number;
  discountAmount: number;
  onDiscountTypeChange: (type: DiscountType) => void;
  onDiscountPercentChange: (percent: number) => void;
  onDiscountAmountChange: (amount: number) => void;
}

export function SalesOrderTotalsCard({
  subtotal,
  discountType,
  discountPercent,
  discountAmount,
  onDiscountTypeChange,
  onDiscountPercentChange,
  onDiscountAmountChange,
}: SalesOrderTotalsCardProps) {
  const calculatedDiscount = discountType === 'percent'
    ? (subtotal * discountPercent) / 100
    : discountAmount;
  const total = subtotal - calculatedDiscount;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm">Tổng tiền hàng</Label>
          <div className="font-semibold">{subtotal.toLocaleString('vi-VN')}</div>
        </div>

        <div className="space-y-2 pt-2">
          <Label className="text-sm">Giảm giá</Label>
          <RadioGroup
            value={discountType}
            onValueChange={(v) => onDiscountTypeChange(v as DiscountType)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="fixed" />
              <Label htmlFor="fixed" className="font-normal text-sm">Số tiền</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percent" id="percent" />
              <Label htmlFor="percent" className="font-normal text-sm">%</Label>
            </div>
          </RadioGroup>

          {discountType === 'fixed' ? (
            <Input
              type="number"
              value={discountAmount}
              onChange={(e) => onDiscountAmountChange(parseFloat(e.target.value) || 0)}
              className="text-right"
              min="0"
              max={subtotal}
            />
          ) : (
            <Input
              type="number"
              value={discountPercent}
              onChange={(e) => onDiscountPercentChange(parseFloat(e.target.value) || 0)}
              className="text-right"
              min="0"
              max="100"
              step="0.5"
            />
          )}
        </div>

        <div className="flex justify-between items-center text-red-500">
          <Label className="text-sm">Giảm giá</Label>
          <div className="font-medium">-{calculatedDiscount.toLocaleString('vi-VN')}</div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t">
          <Label className="font-semibold">Khách cần trả</Label>
          <div className="text-lg font-bold text-primary">
            {total.toLocaleString('vi-VN')}
          </div>
        </div>
      </div>
    </Card>
  );
}
