import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getStatusColor } from '@/lib/utils/status';
import type { ServiceStatus, PriorityLevel } from '@/types';

interface AssignedOrder {
  id: string;
  order_number: string;
  status: ServiceStatus;
  priority: PriorityLevel;
  estimated_completion_date: string;
  motorcycle: {
    license_plate: string;
    brand: string;
    model: string;
  };
  owner_name: string;
  customer_name: string;
  total_tasks: number;
  completed_tasks: number;
}

interface WorkOrderCardProps {
  order: AssignedOrder;
  onViewDetails: (orderId: string) => void;
  onUpdateStatus: (orderId: string, newStatus: ServiceStatus) => void;
}

export function WorkOrderCard({
  order,
  onViewDetails,
  onUpdateStatus,
}: WorkOrderCardProps) {
  const getPriorityColor = (priority: PriorityLevel): string => {
    const colors: Record<PriorityLevel, string> = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return colors[priority];
  };

  const getProgressPercentage = (completed: number, total: number): number => {
    if (total === 0) return 0;
    return (completed / total) * 100;
  };

  const isOverdue = (date: string): boolean => {
    return new Date(date) < new Date();
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base sm:text-lg">
                {order.order_number}
              </CardTitle>
              <Badge className={getPriorityColor(order.priority)}>
                {order.priority.toUpperCase()}
              </Badge>
              {order.estimated_completion_date && isOverdue(order.estimated_completion_date) && (
                <Badge variant="destructive">OVERDUE</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {order.motorcycle.brand} {order.motorcycle.model} ({order.motorcycle.license_plate})
            </p>
          </div>
          <Badge className={`${getStatusColor(order.status)} flex-shrink-0`}>
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        {/* Owner and Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Owner:</span>{' '}
            <span className="font-medium">{order.owner_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Customer:</span>{' '}
            <span className="font-medium">{order.customer_name}</span>
          </div>
        </div>

        {/* Due Date */}
        {order.estimated_completion_date && (
          <div className="text-sm">
            <span className="text-muted-foreground">Due:</span>{' '}
            <span className={`font-medium ${isOverdue(order.estimated_completion_date) ? 'text-red-600' : ''}`}>
              {new Date(order.estimated_completion_date).toLocaleDateString()} at{' '}
              {new Date(order.estimated_completion_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Task Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Task Progress</span>
            <span className="font-medium">
              {order.completed_tasks} of {order.total_tasks} complete
            </span>
          </div>
          <Progress value={getProgressPercentage(order.completed_tasks, order.total_tasks)} />
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            onClick={() => onViewDetails(order.id)}
            className="flex-1"
          >
            View Details
          </Button>

          {order.status === 'confirmed' && (
            <Button
              variant="outline"
              onClick={() => onUpdateStatus(order.id, 'in_progress')}
              className="sm:flex-initial"
            >
              Start Work
            </Button>
          )}

          {order.status === 'in_progress' && order.completed_tasks === order.total_tasks && order.total_tasks > 0 && (
            <Button
              variant="outline"
              onClick={() => onUpdateStatus(order.id, 'waiting_approval')}
              className="sm:flex-initial"
            >
              Request Approval
            </Button>
          )}

          {order.status === 'quality_check' && (
            <Button
              variant="outline"
              onClick={() => onUpdateStatus(order.id, 'completed')}
              className="sm:flex-initial"
            >
              Mark Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
