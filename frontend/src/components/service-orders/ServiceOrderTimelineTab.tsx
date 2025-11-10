import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ServiceOrderTimelineTabProps {
  order: any;
}

export function ServiceOrderTimelineTab({ order }: ServiceOrderTimelineTabProps) {
  const { t } = useTranslation();

  return (
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
  );
}
