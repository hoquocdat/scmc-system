import { Badge } from '@/components/ui/badge';
import type { PayrollPeriodStatus, PayrollSlipStatus } from '@/lib/api/payroll';

interface PayrollPeriodStatusBadgeProps {
  status: PayrollPeriodStatus;
}

const periodStatusConfig: Record<
  PayrollPeriodStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Nháp', variant: 'secondary' },
  published: { label: 'Đã công bố', variant: 'default' },
  finalized: { label: 'Đã hoàn thành', variant: 'outline' },
  paid: { label: 'Đã thanh toán', variant: 'outline' },
};

export function PayrollPeriodStatusBadge({ status }: PayrollPeriodStatusBadgeProps) {
  const config = periodStatusConfig[status] || { label: status, variant: 'secondary' as const };

  return (
    <Badge
      variant={config.variant}
      className={
        status === 'paid'
          ? 'bg-green-100 text-green-800 border-green-200'
          : status === 'finalized'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : undefined
      }
    >
      {config.label}
    </Badge>
  );
}

interface PayrollSlipStatusBadgeProps {
  status: PayrollSlipStatus;
}

const slipStatusConfig: Record<
  PayrollSlipStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Nháp', variant: 'secondary' },
  published: { label: 'Chờ xác nhận', variant: 'default' },
  disputed: { label: 'Khiếu nại', variant: 'destructive' },
  confirmed: { label: 'Đã xác nhận', variant: 'outline' },
  finalized: { label: 'Hoàn thành', variant: 'outline' },
  paid: { label: 'Đã thanh toán', variant: 'outline' },
};

export function PayrollSlipStatusBadge({ status }: PayrollSlipStatusBadgeProps) {
  const config = slipStatusConfig[status] || { label: status, variant: 'secondary' as const };

  return (
    <Badge
      variant={config.variant}
      className={
        status === 'paid'
          ? 'bg-green-100 text-green-800 border-green-200'
          : status === 'confirmed'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : status === 'disputed'
          ? 'bg-red-100 text-red-800 border-red-200'
          : undefined
      }
    >
      {config.label}
    </Badge>
  );
}
