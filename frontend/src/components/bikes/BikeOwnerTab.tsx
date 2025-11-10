import { OwnerCard } from '@/components/owners/OwnerCard';
import type { Customer } from '@/types';

interface BikeOwnerTabProps {
  owner: Customer | null;
}

export function BikeOwnerTab({ owner }: BikeOwnerTabProps) {
  if (!owner) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Không có thông tin chủ xe
      </p>
    );
  }

  return <OwnerCard owner={owner} />;
}
