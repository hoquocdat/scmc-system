import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tierCode: string;
  tierName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  iron: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  silver: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-400',
  },
  gold: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-500',
  },
};

export function TierBadge({ tierCode, tierName, className, size = 'md' }: TierBadgeProps) {
  const colors = tierColors[tierCode] || tierColors.iron;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        'border',
        sizeClasses[size],
        className
      )}
    >
      {tierName}
    </Badge>
  );
}
