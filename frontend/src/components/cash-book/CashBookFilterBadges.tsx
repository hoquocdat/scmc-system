import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cashBookApi, COUNTERPARTY_LABELS, SOURCE_LABELS } from '@/lib/api/cash-book';
import { storesApi } from '@/lib/api/stores';
import { DATE_PRESET_LABELS } from '@/hooks/useReportFilters';
import type { CashBookFilters } from '@/hooks/useCashBookFilters';

interface Props {
  filters: CashBookFilters;
  activeCount: number;
  onChange: (next: Partial<CashBookFilters>) => void;
  onClear: () => void;
}

/** Active filters under the toolbar, each removable, plus "Xóa tất cả". */
export function CashBookFilterBadges({ filters, activeCount, onChange, onClear }: Props) {
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: !!filters.storeId });
  const { data: accounts = [] } = useQuery({ queryKey: ['cash-book', 'accounts', 'all'], queryFn: () => cashBookApi.accounts(), enabled: !!filters.accountId });
  const { data: categories = [] } = useQuery({ queryKey: ['cash-book', 'categories'], queryFn: () => cashBookApi.categories(), enabled: !!filters.categoryId });

  const period = filters.preset === 'custom' ? `${filters.from} → ${filters.to}` : `${DATE_PRESET_LABELS[filters.preset]} (${filters.from} → ${filters.to})`;
  const badges: { label: string; clear?: Partial<CashBookFilters> }[] = [{ label: period, clear: filters.preset !== 'today' ? { preset: 'today' } : undefined }];
  if (filters.storeId) badges.push({ label: stores.find((s) => s.id === filters.storeId)?.name ?? 'Chi nhánh', clear: { storeId: undefined } });
  if (filters.accountId) badges.push({ label: accounts.find((a) => a.id === filters.accountId)?.name ?? 'Tài khoản', clear: { accountId: undefined } });
  if (filters.direction) badges.push({ label: filters.direction === 'in' ? 'Phiếu thu' : 'Phiếu chi', clear: { direction: undefined } });
  if (filters.categoryId) badges.push({ label: categories.find((c) => c.id === filters.categoryId)?.name ?? 'Loại thu chi', clear: { categoryId: undefined } });
  if (filters.counterpartyType) badges.push({ label: COUNTERPARTY_LABELS[filters.counterpartyType], clear: { counterpartyType: undefined } });
  if (filters.counterparty) badges.push({ label: `"${filters.counterparty}"`, clear: { counterparty: undefined } });
  if (filters.sourceType) badges.push({ label: SOURCE_LABELS[filters.sourceType] ?? filters.sourceType, clear: { sourceType: undefined } });
  if (filters.status) badges.push({ label: filters.status === 'posted' ? 'Đã ghi sổ' : 'Đã hủy', clear: { status: undefined } });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {badges.map((b) => (
        <Badge key={b.label} variant="secondary" className="gap-1 pr-1">
          {b.label}
          {b.clear && (
            <button type="button" aria-label={`Bỏ lọc ${b.label}`} className="rounded-full p-0.5 hover:bg-muted-foreground/20" onClick={() => onChange(b.clear!)}>
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {activeCount > 0 && (
        <>
          <span className="text-muted-foreground">{activeCount} bộ lọc</span>
          <Button variant="ghost" size="sm" onClick={onClear}>Xóa tất cả</Button>
        </>
      )}
    </div>
  );
}
