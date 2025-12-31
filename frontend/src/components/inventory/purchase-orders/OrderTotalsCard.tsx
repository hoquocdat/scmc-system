import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OrderTotalsCardProps {
  subtotal: number;
  discount?: number;
  paidAmount?: number;
  cashAmount?: number;
}

export function OrderTotalsCard({
  subtotal,
  discount = 0,
  paidAmount = 0,
  cashAmount = 0,
}: OrderTotalsCardProps) {
  const totalDue = subtotal - discount;
  const creditAmount = totalDue - paidAmount;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm">Tổng tiền hàng</Label>
          <div className="font-semibold">{subtotal.toLocaleString('vi-VN')}</div>
        </div>

        <div className="flex justify-between items-center">
          <Label className="text-sm">Giảm giá</Label>
          <Input
            type="number"
            value={discount}
            className="w-32 text-right"
            disabled
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t">
          <Label className="font-semibold">Cần trả nhà cung cấp</Label>
          <div className="text-lg font-bold text-primary">
            {totalDue.toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Label className="text-sm">Tiền trả nhà cung cấp (F8)</Label>
          <Input
            type="number"
            value={paidAmount}
            className="w-32 text-right"
            disabled
          />
        </div>

        <div className="flex justify-between items-center">
          <Label className="text-sm">Tiền mặt</Label>
          <Input
            type="number"
            value={cashAmount}
            className="w-32 text-right"
            disabled
          />
        </div>

        <div className="flex justify-between items-center">
          <Label className="text-sm">Tính vào công nợ</Label>
          <div className="font-semibold text-destructive">
            -{creditAmount.toLocaleString('vi-VN')}
          </div>
        </div>
      </div>
    </Card>
  );
}
