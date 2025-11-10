import { getStatusColor } from '@/lib/utils/status';
import { STATUS_LABELS } from '@/components/forms/StatusSelect';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)} ${className}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
