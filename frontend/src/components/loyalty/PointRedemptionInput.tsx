import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { loyaltyApi, formatPoints } from '@/lib/api/loyalty';
import { Gift, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointRedemptionInputProps {
  customerId: string;
  orderAmount: number;
  onRedemptionChange: (points: number, discountAmount: number) => void;
  disabled?: boolean;
}

export function PointRedemptionInput({
  customerId,
  orderAmount,
  onRedemptionChange,
  disabled = false,
}: PointRedemptionInputProps) {
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const { data: redemptionPreview, isLoading } = useQuery({
    queryKey: ['redemptionPreview', customerId, orderAmount],
    queryFn: () => loyaltyApi.calculateRedemption(customerId, orderAmount),
    enabled: !!customerId && orderAmount > 0,
  });

  // Reset when customer or order amount changes
  useEffect(() => {
    setPointsToRedeem(0);
    setUsePoints(false);
    onRedemptionChange(0, 0);
  }, [customerId, orderAmount]);

  // Update parent when points change
  useEffect(() => {
    if (!usePoints || !redemptionPreview) {
      onRedemptionChange(0, 0);
      return;
    }

    const discountAmount = pointsToRedeem * redemptionPreview.redemptionRate;
    onRedemptionChange(pointsToRedeem, discountAmount);
  }, [pointsToRedeem, usePoints, redemptionPreview]);

  if (!customerId || orderAmount <= 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!redemptionPreview || redemptionPreview.pointsAvailable < redemptionPreview.minRedemptionPoints) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gift className="h-4 w-4" />
            <span>
              {!redemptionPreview
                ? 'Không có thông tin điểm thưởng'
                : `Cần tối thiểu ${redemptionPreview.minRedemptionPoints} điểm để đổi (hiện có ${formatPoints(redemptionPreview.pointsAvailable)} điểm)`}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const discountAmount = pointsToRedeem * redemptionPreview.redemptionRate;
  const canRedeem = redemptionPreview.maxRedeemablePoints >= redemptionPreview.minRedemptionPoints;

  return (
    <Card className={cn(usePoints && 'border-primary')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Sử dụng điểm thưởng
          </CardTitle>
          <Switch
            checked={usePoints}
            onCheckedChange={(checked) => {
              setUsePoints(checked);
              if (!checked) {
                setPointsToRedeem(0);
              }
            }}
            disabled={disabled || !canRedeem}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Điểm khả dụng:</span>
          <span className="font-medium">{formatPoints(redemptionPreview.pointsAvailable)} điểm</span>
        </div>

        {usePoints && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Số điểm đổi:</Label>
                <span className="text-muted-foreground">
                  Tối đa: {formatPoints(redemptionPreview.maxRedeemablePoints)} điểm
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min={0}
                  max={redemptionPreview.maxRedeemablePoints}
                  step={100}
                  value={pointsToRedeem}
                  onChange={(e) => {
                    const value = Math.min(
                      Math.max(0, parseInt(e.target.value) || 0),
                      redemptionPreview.maxRedeemablePoints
                    );
                    setPointsToRedeem(value);
                  }}
                  className="w-32"
                  disabled={disabled}
                />
                <span className="text-sm text-muted-foreground">điểm</span>
              </div>
              <Slider
                value={[pointsToRedeem]}
                min={0}
                max={redemptionPreview.maxRedeemablePoints}
                step={100}
                onValueChange={(values) => setPointsToRedeem(values[0])}
                disabled={disabled}
                className="mt-2"
              />
            </div>

            {pointsToRedeem > 0 && pointsToRedeem < redemptionPreview.minRedemptionPoints && (
              <div className="flex items-center gap-1 text-sm text-amber-600">
                <AlertCircle className="h-3 w-3" />
                <span>Tối thiểu {redemptionPreview.minRedemptionPoints} điểm</span>
              </div>
            )}

            {pointsToRedeem >= redemptionPreview.minRedemptionPoints && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Minus className="h-4 w-4" />
                    <span className="font-medium">Giảm giá từ điểm:</span>
                  </div>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">
                    -{discountAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-xs text-muted-foreground border-t pt-2">
          Quy đổi: 1 điểm = {redemptionPreview.redemptionRate.toLocaleString('vi-VN')} ₫ |
          Tối đa {redemptionPreview.maxRedemptionPercent}% giá trị đơn hàng
        </div>
      </CardContent>
    </Card>
  );
}
