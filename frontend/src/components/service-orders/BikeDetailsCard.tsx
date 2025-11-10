import { useTranslation } from 'react-i18next';

interface BikeDetailsCardProps {
  bike?: {
    brand: string;
    model: string;
    license_plate: string;
    year?: number;
    color?: string;
  };
}

export function BikeDetailsCard({ bike }: BikeDetailsCardProps) {
  const { t } = useTranslation();

  if (!bike) {
    return (
      <div>
        <label className="text-sm font-medium text-muted-foreground">{t('serviceOrders.bike')}</label>
        <p className="text-sm text-muted-foreground italic">Không có thông tin xe</p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-muted-foreground">{t('serviceOrders.bike')}</label>
      <p className="text-lg font-semibold">
        {bike.brand} {bike.model}
      </p>
      <p className="text-sm text-muted-foreground font-mono">
        {bike.license_plate}
        {bike.year && ` • ${bike.year}`}
        {bike.color && ` • ${bike.color}`}
      </p>
    </div>
  );
}
