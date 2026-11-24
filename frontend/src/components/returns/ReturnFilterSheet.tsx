import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { storesApi } from '@/lib/api/stores';
import { DATE_PRESET_LABELS, presetRange, type DatePreset } from '@/hooks/useReportFilters';
import type { ReturnFilters } from '@/hooks/useReturnFilters';

const ALL = '__all__';
const KIND_LABELS = { return: 'Trả hàng', exchange: 'Đổi hàng' } as const;

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ReturnFilters;
  onApply: (next: Partial<ReturnFilters>) => void;
  onClear: () => void;
}

/** "Lọc" sheet of the returns list. */
export function ReturnFilterSheet({ open, onOpenChange, filters, onApply, onClear }: SheetProps) {
  const [local, setLocal] = useState(filters);
  useEffect(() => setLocal(filters), [filters, open]);
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: open });
  const set = (patch: Partial<ReturnFilters>) => setLocal((p) => ({ ...p, ...patch }));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6"><SheetTitle>Lọc phiếu trả hàng</SheetTitle></SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <Label>Thời gian</Label>
            <Select value={local.preset} onValueChange={(v) => { const p = v as DatePreset; set({ preset: p, ...(p === 'custom' ? {} : presetRange(p)) }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DATE_PRESET_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="rf-from">Từ ngày</Label><Input id="rf-from" type="date" value={local.from} onChange={(e) => set({ preset: 'custom', from: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="rf-to">Đến ngày</Label><Input id="rf-to" type="date" value={local.to} onChange={(e) => set({ preset: 'custom', to: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Chi nhánh</Label>
            <Select value={local.storeId ?? ALL} onValueChange={(v) => set({ storeId: v === ALL ? undefined : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Tất cả chi nhánh</SelectItem>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Loại phiếu</Label>
            <Select value={local.kind ?? ALL} onValueChange={(v) => set({ kind: v === ALL ? undefined : (v as ReturnFilters['kind']) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Trả và đổi</SelectItem>{Object.entries(KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="gap-2 px-6 pb-6">
          <Button variant="outline" onClick={() => { onClear(); onOpenChange(false); }}>Xóa Bộ Lọc</Button>
          <Button onClick={() => { onApply(local); onOpenChange(false); }}>Áp Dụng</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface BadgesProps {
  filters: ReturnFilters;
  activeCount: number;
  onChange: (next: Partial<ReturnFilters>) => void;
  onClear: () => void;
}

/** Active filters with remove buttons and "Xóa tất cả". */
export function ReturnFilterBadges({ filters, activeCount, onChange, onClear }: BadgesProps) {
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: !!filters.storeId });
  const badges: { label: string; clear?: Partial<ReturnFilters> }[] = [
    { label: filters.preset === 'custom' ? `${filters.from} → ${filters.to}` : DATE_PRESET_LABELS[filters.preset], clear: filters.preset !== 'this_month' ? { preset: 'this_month' } : undefined },
  ];
  if (filters.storeId) badges.push({ label: stores.find((s) => s.id === filters.storeId)?.name ?? 'Chi nhánh', clear: { storeId: undefined } });
  if (filters.kind) badges.push({ label: KIND_LABELS[filters.kind], clear: { kind: undefined } });
  if (filters.search) badges.push({ label: `"${filters.search}"`, clear: { search: undefined } });
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {badges.map((b) => (
        <Badge key={b.label} variant="secondary" className="gap-1 pr-1">
          {b.label}
          {b.clear && <button type="button" aria-label={`Bỏ lọc ${b.label}`} className="rounded-full p-0.5 hover:bg-muted-foreground/20" onClick={() => onChange(b.clear!)}><X className="h-3 w-3" /></button>}
        </Badge>
      ))}
      {activeCount > 0 && <><span className="text-muted-foreground">{activeCount} bộ lọc</span><Button variant="ghost" size="sm" onClick={onClear}>Xóa tất cả</Button></>}
    </div>
  );
}
