import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { stockOpsApi, type ProductUnit } from '@/lib/api/stock-operations';

const BASE = '__base__';

interface Props {
  productId: string;
  value: string | null | undefined;
  onChange: (unit: ProductUnit | null) => void;
}

/** Base unit or a conversion unit for a sale line; hidden when the product has no units. */
export function LineUnitSelect({ productId, value, onChange }: Props) {
  const { data } = useQuery({ queryKey: ['product-units', productId], queryFn: () => stockOpsApi.units(productId), staleTime: 300_000 });
  const units = data?.units.filter((u) => u.is_active) ?? [];
  if (!units.length) return null;
  return (
    <Select value={value ?? BASE} onValueChange={(v) => onChange(v === BASE ? null : (units.find((u) => u.id === v) ?? null))}>
      <SelectTrigger className="h-7 w-28 text-xs" aria-label="Đơn vị tính"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={BASE}>{data?.base_unit ?? 'cái'}</SelectItem>
        {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.factor})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
