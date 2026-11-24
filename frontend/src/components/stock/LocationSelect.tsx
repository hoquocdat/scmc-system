import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { stockLocationsApi } from '@/lib/api/stock-locations';

interface Props {
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  exclude?: string;
  id?: string;
}

/** Active stock locations (branch stores, warehouse, workshop). */
export function LocationSelect({ value, onChange, placeholder = 'Chọn kho', exclude, id }: Props) {
  const { data: locations = [] } = useQuery({ queryKey: ['stock-locations'], queryFn: stockLocationsApi.getAll });
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {locations.filter((l) => l.is_active && l.id !== exclude).map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
