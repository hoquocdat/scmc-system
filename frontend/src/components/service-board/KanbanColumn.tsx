import { Badge } from '@/components/ui/badge';
import { ServiceOrderCard } from './ServiceOrderCard';
import type { ServiceOrder, UserProfile } from '@/types';

interface KanbanColumnProps {
  label: string;
  color: string;
  orders: ServiceOrder[];
  isFullscreen: boolean;
  employees: UserProfile[];
  onOrderClick: (orderId: string) => void;
}

export function KanbanColumn({
  label,
  color,
  orders,
  isFullscreen,
  employees,
  onOrderClick,
}: KanbanColumnProps) {
  const getEmployeeName = (employeeId?: string | null): string => {
    if (!employeeId) return 'Chưa phân công';
    const employee = employees.find(e => e.id === employeeId);
    return employee?.full_name || 'Không xác định';
  };

  return (
    <div className={`${isFullscreen ? '' : 'flex-shrink-0 w-72 sm:w-80'}`}>
      {/* Column Header */}
      <div className={`${color} rounded-t-lg border-b-2 border-gray-300 ${isFullscreen ? 'px-3 py-2' : 'px-3 py-2 sm:px-4 sm:py-3'}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold truncate ${isFullscreen ? 'text-sm' : 'text-sm sm:text-base'}`}>
            {label}
          </h3>
          <Badge variant="secondary" className={`ml-1 flex-shrink-0 text-xs ${isFullscreen ? 'px-2 py-0.5' : 'px-2 py-0.5'}`}>
            {orders.length}
          </Badge>
        </div>
      </div>

      {/* Column Content */}
      <div className={`bg-gray-50 rounded-b-lg space-y-2 sm:space-y-3 overflow-y-auto ${isFullscreen ? 'h-[calc(100vh-280px)] p-2' : 'min-h-[400px] sm:min-h-[500px] p-2 sm:p-3'}`}>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Không có đơn nào
          </p>
        ) : (
          orders.map(order => (
            <ServiceOrderCard
              key={order.id}
              order={order}
              isFullscreen={isFullscreen}
              employeeName={getEmployeeName(order.assigned_employee_id)}
              onClick={() => onOrderClick(order.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
