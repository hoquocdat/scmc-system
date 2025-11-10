import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, FileText } from 'lucide-react';
import type { ServiceOrder } from '../../types';
import { getStatusColor, getStatusLabelSimple } from '@/lib/utils/status';

interface CustomerServiceHistoryTabProps {
  serviceOrders: ServiceOrder[];
}

export function CustomerServiceHistoryTab({ serviceOrders }: CustomerServiceHistoryTabProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Wrench className="h-4 w-4 sm:h-5 sm:w-5" />
          Lịch Sử Dịch Vụ ({serviceOrders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {serviceOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Chưa có service order nào
          </p>
        ) : (
          <div className="space-y-3">
            {serviceOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => navigate(`/service-orders/${order.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm sm:text-base">{order.order_number}</span>
                    <Badge className={getStatusColor(order.status) + " text-xs"}>
                      {getStatusLabelSimple(order.status)}
                    </Badge>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                    {order.description || 'Không có mô tả'}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3 inline" />
                      <span className="hidden sm:inline">Tạo ngày: </span>
                      {new Date(order.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {order.mileage_in && (
                      <span>Km: {order.mileage_in.toLocaleString()} km</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="self-end sm:self-center text-xs sm:text-sm">
                  <span className="hidden sm:inline">Xem Chi Tiết</span>
                  <span className="sm:hidden">Xem</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
