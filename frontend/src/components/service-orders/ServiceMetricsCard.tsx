import { useTranslation } from 'react-i18next';

interface ServiceMetricsCardProps {
  mileageIn?: number;
  estimatedCost?: number;
  estimatedCompletionDate?: string;
}

export function ServiceMetricsCard({
  mileageIn,
  estimatedCost,
  estimatedCompletionDate,
}: ServiceMetricsCardProps) {
  const { t } = useTranslation();

  const hasAnyMetric = mileageIn || estimatedCost || estimatedCompletionDate;

  if (!hasAnyMetric) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {mileageIn && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            {t('serviceOrders.mileageIn')}
          </label>
          <p className="text-lg font-semibold">
            {mileageIn.toLocaleString()} km
          </p>
        </div>
      )}

      {estimatedCost && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            {t('serviceOrders.estimatedCost')}
          </label>
          <p className="text-lg font-semibold">
            ${estimatedCost.toFixed(2)}
          </p>
        </div>
      )}

      {estimatedCompletionDate && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            {t('serviceOrders.estimatedCompletion')}
          </label>
          <p className="text-lg font-semibold">
            {new Date(estimatedCompletionDate).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
