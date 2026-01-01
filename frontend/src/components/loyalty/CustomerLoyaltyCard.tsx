import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { loyaltyApi, formatPoints } from '@/lib/api/loyalty';
import { TierBadge } from './TierBadge';
import { Gift, Star, TrendingUp } from 'lucide-react';

interface CustomerLoyaltyCardProps {
  customerId: string;
  showProgress?: boolean;
  compact?: boolean;
}

export function CustomerLoyaltyCard({
  customerId,
  showProgress = true,
  compact = false,
}: CustomerLoyaltyCardProps) {
  const { data: loyalty, isLoading } = useQuery({
    queryKey: ['customerLoyalty', customerId],
    queryFn: () => loyaltyApi.getCustomerLoyalty(customerId),
    enabled: !!customerId,
  });

  if (!customerId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!loyalty) {
    return null;
  }

  const progressPercent = loyalty.pointsToNextTier
    ? Math.min(
        100,
        ((loyalty.pointsEarnedLifetime - (loyalty.tier?.minPoints || 0)) /
          (loyalty.pointsToNextTier + loyalty.pointsEarnedLifetime - (loyalty.tier?.minPoints || 0))) *
          100
      )
    : 100;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{formatPoints(loyalty.pointsBalance)} điểm</span>
          {loyalty.tier && (
            <TierBadge tierCode={loyalty.tier.code} tierName={loyalty.tier.name} size="sm" />
          )}
        </div>
        {loyalty.tier && loyalty.tier.pointsMultiplier > 1 && (
          <span className="text-xs text-muted-foreground">
            x{loyalty.tier.pointsMultiplier} điểm thưởng
          </span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Điểm thưởng
          </CardTitle>
          {loyalty.tier && (
            <TierBadge tierCode={loyalty.tier.code} tierName={loyalty.tier.name} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">
            {formatPoints(loyalty.pointsBalance)}
          </span>
          <span className="text-sm text-muted-foreground">điểm khả dụng</span>
        </div>

        {loyalty.tier && loyalty.tier.pointsMultiplier > 1 && (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="h-3 w-3" />
            <span>Nhận x{loyalty.tier.pointsMultiplier} điểm thưởng</span>
          </div>
        )}

        {showProgress && loyalty.nextTierName && loyalty.pointsToNextTier && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{loyalty.tier?.name || 'Iron Rider'}</span>
              <span>{loyalty.nextTierName}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Còn {formatPoints(loyalty.pointsToNextTier)} điểm nữa để lên hạng
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-sm">
          <div>
            <span className="text-muted-foreground">Đã tích lũy:</span>
            <span className="ml-1 font-medium">{formatPoints(loyalty.pointsEarnedLifetime)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Đã sử dụng:</span>
            <span className="ml-1 font-medium">{formatPoints(loyalty.pointsRedeemedLifetime)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
