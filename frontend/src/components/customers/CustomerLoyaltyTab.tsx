import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  loyaltyApi,
  formatPoints,
  formatPointsValue,
} from '@/lib/api/loyalty';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { LoyaltyHistoryTable } from '@/components/loyalty/LoyaltyHistoryTable';
import { Gift, Star, TrendingUp, Award, ArrowUp } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface CustomerLoyaltyTabProps {
  customerId: string;
}

export function CustomerLoyaltyTab({ customerId }: CustomerLoyaltyTabProps) {
  const { data: loyalty, isLoading } = useQuery({
    queryKey: ['customerLoyalty', customerId],
    queryFn: () => loyaltyApi.getCustomerLoyalty(customerId),
    enabled: !!customerId,
  });

  const { data: rules } = useQuery({
    queryKey: ['loyaltyRules'],
    queryFn: () => loyaltyApi.getRules(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!loyalty) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Khách hàng chưa tham gia chương trình khách hàng thân thiết
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Điểm thưởng sẽ được tích lũy tự động khi khách hàng thanh toán đơn hàng
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressToNextTier = loyalty.pointsToNextTier && loyalty.tier
    ? Math.min(100, ((loyalty.pointsEarnedLifetime - loyalty.tier.minPoints) / loyalty.pointsToNextTier) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tier Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Hạng thành viên
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <TierBadge
                tierCode={loyalty.tier?.code || 'iron'}
                tierName={loyalty.tier?.name || 'Iron Rider'}
                size="lg"
              />
              {loyalty.tier && (
                <p className="text-xs text-muted-foreground">
                  Hệ số điểm: x{loyalty.tier.pointsMultiplier.toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Points Balance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Star className="h-4 w-4" />
              Điểm khả dụng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-primary">
                {formatPoints(loyalty.pointsBalance)}
              </p>
              {rules && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatPointsValue(loyalty.pointsBalance, rules.redemptionRate)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lifetime Stats Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tổng tích lũy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {formatPoints(loyalty.pointsEarnedLifetime)}
              </p>
              <p className="text-sm text-muted-foreground">
                Đã đổi: {formatPoints(loyalty.pointsRedeemedLifetime)} điểm
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Progress */}
      {loyalty.pointsToNextTier && loyalty.nextTierName && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              Tiến trình nâng hạng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Hạng hiện tại: <strong>{loyalty.tier?.name}</strong>
              </span>
              <span className="text-muted-foreground">
                Hạng tiếp theo: <strong>{loyalty.nextTierName}</strong>
              </span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              Cần thêm <strong className="text-primary">{formatPoints(loyalty.pointsToNextTier)}</strong> điểm để nâng hạng
            </p>
          </CardContent>
        </Card>
      )}

      {/* Spending Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tổng quan chi tiêu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tổng chi tiêu</p>
              <p className="text-xl font-semibold">
                {loyalty.totalSpend.toLocaleString('vi-VN')} ₫
              </p>
            </div>
            {loyalty.tierUpdatedAt && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ngày cập nhật hạng</p>
                <p className="text-xl font-semibold">
                  {format(new Date(loyalty.tierUpdatedAt), 'dd/MM/yyyy', { locale: vi })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Lịch sử điểm thưởng
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LoyaltyHistoryTable customerId={customerId} limit={10} />
        </CardContent>
      </Card>
    </div>
  );
}
