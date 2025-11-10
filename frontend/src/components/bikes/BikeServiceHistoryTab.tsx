import { ServiceOrderCard } from '@/components/service-orders/ServiceOrderCard';
import type { ServiceOrder } from '@/types';

interface BikeServiceHistoryTabProps {
  serviceOrders: ServiceOrder[];
}

export function BikeServiceHistoryTab({ serviceOrders }: BikeServiceHistoryTabProps) {
  if (serviceOrders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Chưa có lịch sử dịch vụ cho xe này
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {serviceOrders.map((order) => (
        <ServiceOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
