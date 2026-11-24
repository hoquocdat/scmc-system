import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { priceBooksApi } from '@/lib/api/price-books';
import { usePermissions } from '@/hooks/usePermissions';

const AUTO = '__auto__';

interface PriceBookPickerProps {
  storeId?: string | null;
  customerId?: string | null;
  value: string | null | undefined;
  onChange: (priceBookId: string | null) => void;
  className?: string;
}

/**
 * "Bảng giá: Tự động" or a chosen book for the whole sale. Shown only to staff
 * with price_books:apply and when at least one book allows manual choice here.
 * In automatic mode it names the books that apply to this customer.
 */
export function PriceBookPicker({ storeId, customerId, value, onChange, className }: PriceBookPickerProps) {
  const { can } = usePermissions();
  const { data } = useQuery({
    queryKey: ['pricing', 'applicable-books', storeId, customerId ?? null],
    queryFn: () => priceBooksApi.applicableBooks(storeId!, customerId),
    enabled: !!storeId && can('price_books', 'read'),
    staleTime: 60_000,
  });
  const canChoose = can('price_books', 'apply') && (data?.choosable.length ?? 0) > 0;
  const autoLabel = data?.automatic.length ? `Tự động (${data.automatic.map((b) => b.name).join(', ')})` : 'Tự động · giá chung';

  if (!canChoose) {
    return data?.automatic.length ? (
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> Bảng giá: {data.automatic.map((b) => b.name).join(', ')}</p>
    ) : null;
  }
  return (
    <Select value={value ?? AUTO} onValueChange={(v) => onChange(v === AUTO ? null : v)}>
      <SelectTrigger className={className} aria-label="Bảng giá"><BookOpen className="h-4 w-4" /><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>{autoLabel}</SelectItem>
        {data?.choosable.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
