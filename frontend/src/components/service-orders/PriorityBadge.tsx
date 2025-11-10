import { PRIORITY_LABELS } from '@/components/forms/PrioritySelect';

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-700',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
};

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(priority)} ${className}`}
    >
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
