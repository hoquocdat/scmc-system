import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ServiceOrder, PriorityLevel } from '@/types';

interface DraggableServiceOrderCardProps {
  order: ServiceOrder;
  isFullscreen: boolean;
  employeeName: string;
  onClick: () => void;
}

const getPriorityColor = (priority: PriorityLevel): string => {
  const colors: Record<PriorityLevel, string> = {
    low: 'bg-gray-100 text-gray-800',
    normal: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
  };
  return colors[priority];
};

const getPriorityLabel = (priority: PriorityLevel): string => {
  const labels: Record<PriorityLevel, string> = {
    low: 'Thấp',
    normal: 'Bình Thường',
    high: 'Cao',
    urgent: 'Khẩn Cấp',
  };
  return labels[priority];
};

export function DraggableServiceOrderCard({
  order,
  isFullscreen,
  employeeName,
  onClick,
}: DraggableServiceOrderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
    data: {
      type: 'serviceOrder',
      order,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  };

  const orderData = order as any;
  const bikeName = orderData.motorcycles
    ? `${orderData.motorcycles.brand} ${orderData.motorcycles.model}`
    : 'N/A';
  const licensePlate = orderData.motorcycles?.license_plate || '';
  const customerName = orderData.customers?.full_name || 'N/A';

  const handleClick = () => {
    // Only trigger onClick if not dragging
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary/50' : ''
      }`}
      onClick={handleClick}
    >
      <CardHeader className={`${isFullscreen ? 'p-2 pb-2' : 'p-3 pb-2 sm:p-4 sm:pb-3'}`}>
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <CardTitle className={`font-semibold truncate ${isFullscreen ? 'text-xs' : 'text-xs sm:text-sm'}`}>
              {bikeName}
            </CardTitle>
            {licensePlate && (
              <p className="text-muted-foreground font-mono text-xs mt-0.5">
                {licensePlate}
              </p>
            )}
          </div>
          <Badge
            className={`${getPriorityColor(order.priority)} text-xs px-1.5 py-0 flex-shrink-0`}
            variant="outline"
          >
            {getPriorityLabel(order.priority)}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <span className="truncate">👤 {customerName}</span>
        </div>
      </CardHeader>
      <CardContent className={`pt-0 space-y-1 ${isFullscreen ? 'p-2' : 'p-3 sm:p-4'}`}>
        {order.description && (
          <p className={`text-muted-foreground line-clamp-2 ${isFullscreen ? 'text-xs' : 'text-xs'}`}>
            {order.description}
          </p>
        )}

        <div className={`flex items-center justify-between text-muted-foreground pt-1 border-t ${isFullscreen ? 'text-xs' : 'text-xs'}`}>
          <span className="font-medium truncate">
            {employeeName}
          </span>
          {order.estimated_completion_date && (
            <span className="text-xs flex-shrink-0">
              {new Date(order.estimated_completion_date).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        {order.customer_demand && !isFullscreen && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2 text-xs">
            <p className="font-medium text-yellow-800">Yêu cầu:</p>
            <p className="text-yellow-700 line-clamp-2">{order.customer_demand}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
