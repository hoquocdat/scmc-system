import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { storesApi } from '@/lib/api/stores';
import { stockLocationsApi } from '@/lib/api/stock-locations';
import { DATE_PRESET_LABELS, type ReportFilters } from '@/hooks/useReportFilters';

interface ReportFilterBadgesProps {
  filters: ReportFilters;
  activeCount: number;
  onChange: (next: Partial<ReportFilters>) => void;
  onClear: () => void;
}

/** Active filters shown under the toolbar, each removable, with a "Xóa tất cả" button. */
export function ReportFilterBadges({ filters, activeCount, onChange, onClear }: ReportFilterBadgesProps) {
  const { data: stores } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: !!filters.storeId });
  const { data: locations } = useQuery({ queryKey: ['stock-locations'], queryFn: stockLocationsApi.getAll, enabled: !!filters.locationId });

  const periodLabel =
    filters.preset === 'custom' ? `${filters.from} → ${filters.to}` : `${DATE_PRESET_LABELS[filters.preset]} (${filters.from} → ${filters.to})`;

  const badges: { key: keyof ReportFilters; label: string; removable: boolean }[] = [
    { key: 'preset', label: periodLabel, removable: filters.preset !== 'this_month' },
  ];
  if (filters.storeId) badges.push({ key: 'storeId', label: stores?.find((s) => s.id === filters.storeId)?.name ?? 'Chi nhánh', removable: true });
  if (filters.locationId) badges.push({ key: 'locationId', label: locations?.find((l) => l.id === filters.locationId)?.name ?? 'Kho', removable: true });
  if (filters.type) badges.push({ key: 'type', label: `Loại: ${filters.type}`, removable: true });

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {badges.map((b) => (
        <Badge key={b.key} variant="secondary" className="gap-1 pr-1">
          {b.label}
          {b.removable && (
            <button
              type="button"
              aria-label={`Bỏ lọc ${b.label}`}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              onClick={() => onChange(b.key === 'preset' ? { preset: 'this_month' } : { [b.key]: undefined })}
            >
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
