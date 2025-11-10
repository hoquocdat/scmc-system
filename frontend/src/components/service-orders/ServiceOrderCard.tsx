import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import type { ServiceOrder } from '@/types';
import { getStatusColor, getStatusLabel } from '@/lib/utils/status';

interface ServiceOrderCardProps {
  order: ServiceOrder;
  showDetailButton?: boolean;
}

export function ServiceOrderCard({ order, showDetailButton = true }: ServiceOrderCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
      onClick={() => navigate(`/service-orders/${order.id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium">{order.order_number}</span>
          <Badge className={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground line-clamp-2">
          {order.description || order.customer_demand || 'Không có mô tả'}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center">
            <FileText className="h-3 w-3 inline mr-1" />
            Tạo ngày: {new Date(order.created_at).toLocaleDateString('vi-VN')}
          </span>
          {order.mileage_in && (
            <span>Km: {order.mileage_in.toLocaleString()} km</span>
          )}
          {order.estimated_cost && (
            <span>
              Ước tính: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.estimated_cost)}
            </span>
          )}
        </div>
      </div>
      {showDetailButton && (
        <Button variant="ghost" size="sm" className="shrink-0 ml-2">
          Xem Chi Tiết
        </Button>
      )}
    </div>
  );
}
