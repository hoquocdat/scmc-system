import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BikeDetailsCard } from './BikeDetailsCard';
import { CustomerDetailsCard } from './CustomerDetailsCard';
import { AssignedEmployeeCard } from './AssignedEmployeeCard';
import { ServiceDescriptionCard } from './ServiceDescriptionCard';
import { ServiceMetricsCard } from './ServiceMetricsCard';

interface ServiceOrderOverviewTabProps {
  order: any;
  onEmployeeEdit: () => void;
  onDescriptionUpdate: (description: string) => Promise<void>;
}

export function ServiceOrderOverviewTab({
  order,
  onEmployeeEdit,
  onDescriptionUpdate,
}: ServiceOrderOverviewTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Bike & People */}
      <Card>
        <CardHeader>
          <CardTitle>{t('serviceOrders.serviceDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BikeDetailsCard bike={order.bikes} />
          <CustomerDetailsCard customer={order.customers} />
          <AssignedEmployeeCard
            employee={order.assigned_employee}
            onEdit={onEmployeeEdit}
          />
        </CardContent>
      </Card>

      {/* Customer Demand & Description */}
      <Card>
        <CardHeader>
          <CardTitle>{t('serviceOrders.serviceInformation')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ServiceDescriptionCard
            customerDemand={order.customer_demand}
            description={order.description}
            onDescriptionUpdate={onDescriptionUpdate}
          />
          <ServiceMetricsCard
            mileageIn={order.mileage_in}
            estimatedCost={order.estimated_cost}
            estimatedCompletionDate={order.estimated_completion_date}
          />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t('serviceOrders.timeline')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t('serviceOrders.created')}</p>
            <p className="font-medium">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          {order.drop_off_date && (
            <div>
              <p className="text-muted-foreground">{t('serviceOrders.droppedOff')}</p>
              <p className="font-medium">
                {new Date(order.drop_off_date).toLocaleString()}
              </p>
            </div>
          )}
          {order.actual_completion_date && (
            <div>
              <p className="text-muted-foreground">{t('serviceOrders.completed')}</p>
              <p className="font-medium">
                {new Date(order.actual_completion_date).toLocaleString()}
              </p>
            </div>
          )}
          {order.pickup_date && (
            <div>
              <p className="text-muted-foreground">{t('serviceOrders.pickedUp')}</p>
              <p className="font-medium">
                {new Date(order.pickup_date).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
