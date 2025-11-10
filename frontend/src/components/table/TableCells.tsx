import type { Motorcycle, Customer } from '../../types';

interface BikeCellProps {
  bike?: Motorcycle | {
    license_plate: string;
    brand: string;
    model: string;
    year?: number;
  } | null;
  showYear?: boolean;
}

interface CustomerCellProps {
  customer?: Customer | {
    full_name: string;
    phone: string;
  } | null;
  showEmail?: boolean;
}

export function BikeCell({ bike, showYear = false }: BikeCellProps) {
  if (!bike) {
    return <div className="text-muted-foreground">-</div>;
  }

  return (
    <div>
      <div className="font-medium font-mono">{bike.license_plate}</div>
      <div className="text-xs text-muted-foreground">
        {bike.brand} {bike.model}
        {showYear && bike.year ? ` (${bike.year})` : ''}
      </div>
    </div>
  );
}

export function CustomerCell({ customer, showEmail = false }: CustomerCellProps) {
  if (!customer) {
    return <div className="text-muted-foreground">-</div>;
  }

  return (
    <div>
      <div className="font-medium">{customer.full_name}</div>
      <div className="text-xs text-muted-foreground">
        {showEmail && 'email' in customer && customer.email
          ? customer.email
          : customer.phone}
      </div>
    </div>
  );
}
