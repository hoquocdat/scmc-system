import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { storesApi } from '@/lib/api/stores';
import { stockLocationsApi } from '@/lib/api/stock-locations';
import { DATE_PRESET_LABELS, type DatePreset, type ReportFilters, presetRange } from '@/hooks/useReportFilters';

export interface ReportFilterOptions {
  store?: boolean;
  interval?: boolean;
  location?: boolean;
  movementType?: boolean;
  limit?: boolean;
  sortBy?: { label: string; options: { value: string; label: string }[] };
}

interface ReportFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ReportFilters;
  options: ReportFilterOptions;
  onApply: (filters: Partial<ReportFilters>) => void;
  onClear: () => void;
}

const MOVEMENT_TYPES = [
  { value: 'SALE', label: 'Bán hàng' },
  { value: 'RECEIVE', label: 'Nhập hàng' },
  { value: 'RETURN', label: 'Trả hàng' },
  { value: 'ADJUST', label: 'Điều chỉnh' },
  { value: 'TRANSFER_IN', label: 'Chuyển đến' },
  { value: 'TRANSFER_OUT', label: 'Chuyển đi' },
];

const ALL = '__all__';

/** Standard "Lọc" sheet for reports: period preset or custom dates, branch, and report-specific options. */
export function ReportFilterSheet({ open, onOpenChange, filters, options, onApply, onClear }: ReportFilterSheetProps) {
  const [local, setLocal] = useState<ReportFilters>(filters);
  useEffect(() => setLocal(filters), [filters, open]);

  const { data: stores } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: !!options.store && open });
  const { data: locations } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: stockLocationsApi.getAll,
    enabled: !!options.location && open,
  });

  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K] | undefined) =>
    setLocal((prev) => ({ ...prev, [key]: value === ALL ? undefined : value }));

  const setPreset = (preset: DatePreset) => {
    const range = preset === 'custom' ? { from: local.from, to: local.to } : presetRange(preset);
    setLocal((prev) => ({ ...prev, preset, ...range }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Bộ lọc báo cáo</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-6 space-y-6">
          <div className="space-y-2">
            <Label>Kỳ báo cáo</Label>
            <Select value={local.preset} onValueChange={(v) => setPreset(v as DatePreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-from">Từ ngày</Label>
              <Input id="report-from" type="date" value={local.from} max={local.to}
                onChange={(e) => setLocal((p) => ({ ...p, preset: 'custom', from: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to">Đến ngày</Label>
              <Input id="report-to" type="date" value={local.to} min={local.from}
                onChange={(e) => setLocal((p) => ({ ...p, preset: 'custom', to: e.target.value }))} />
            </div>
          </div>

          {options.store && (
            <div className="space-y-2">
              <Label>Chi nhánh</Label>
              <Select value={local.storeId ?? ALL} onValueChange={(v) => set('storeId', v)}>
                <SelectTrigger><SelectValue placeholder="Tất cả chi nhánh" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả chi nhánh</SelectItem>
                  {stores?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {options.location && (
            <div className="space-y-2">
              <Label>Kho</Label>
              <Select value={local.locationId ?? ALL} onValueChange={(v) => set('locationId', v)}>
                <SelectTrigger><SelectValue placeholder="Tất cả kho" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả kho</SelectItem>
                  {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {options.interval && (
            <div className="space-y-2">
              <Label>Nhóm theo</Label>
              <Select value={local.interval ?? 'daily'} onValueChange={(v) => set('interval', v as ReportFilters['interval'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Ngày</SelectItem>
                  <SelectItem value="weekly">Tuần</SelectItem>
                  <SelectItem value="monthly">Tháng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {options.movementType && (
            <div className="space-y-2">
              <Label>Loại giao dịch</Label>
              <Select value={local.type ?? ALL} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả</SelectItem>
                  {MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {options.sortBy && (
            <div className="space-y-2">
              <Label>{options.sortBy.label}</Label>
              <Select value={local.sortBy ?? options.sortBy.options[0].value} onValueChange={(v) => set('sortBy', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.sortBy.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {options.limit && (
            <div className="space-y-2">
              <Label htmlFor="report-limit">Số dòng</Label>
              <Input id="report-limit" type="number" min={1} max={500} value={local.limit ?? 10}
                onChange={(e) => set('limit', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 gap-2">
          <Button variant="outline" onClick={() => { onClear(); onOpenChange(false); }}>Xóa Bộ Lọc</Button>
          <Button onClick={() => { onApply(local); onOpenChange(false); }}>Áp Dụng</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
