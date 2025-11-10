import { useTranslation } from 'react-i18next';

interface CustomerDetailsCardProps {
  customer?: {
    full_name: string;
    phone: string;
  };
}

export function CustomerDetailsCard({ customer }: CustomerDetailsCardProps) {
  const { t } = useTranslation();

  if (!customer) {
    return (
      <div className="pt-4 border-t">
        <label className="text-sm font-medium text-muted-foreground">
          {t('serviceOrders.broughtBike')} 🏍️
        </label>
        <p className="text-sm text-muted-foreground italic mt-1">Không có thông tin khách hàng</p>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t">
      <label className="text-sm font-medium text-muted-foreground">
        {t('serviceOrders.broughtBike')} 🏍️
      </label>
      <p className="font-semibold mt-1">{customer.full_name}</p>
      <p className="text-sm text-muted-foreground">
        {customer.phone}
      </p>
    </div>
  );
}
