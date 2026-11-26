import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cashBookApi, COUNTERPARTY_LABELS, SOURCE_LABELS } from '@/lib/api/cash-book';
import { storesApi } from '@/lib/api/stores';
import { DATE_PRESET_LABELS, presetRange, type DatePreset } from '@/hooks/useReportFilters';
import type { CashBookFilters } from '@/hooks/useCashBookFilters';
import { AccountSelect } from './AccountSelect';

const ALL = '__all__';

interface CashBookFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CashBookFilters;
  onApply: (next: Partial<CashBookFilters>) => void;
  onClear: () => void;
}

/** "Lọc" sheet for the cash book list. */
export function CashBookFilterSheet({ open, onOpenChange, filters, onApply, onClear }: CashBookFilterSheetProps) {
  const [local, setLocal] = useState(filters);
  useEffect(() => setLocal(filters), [filters, open]);
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: open });
  const { data: categories = [] } = useQuery({ queryKey: ['cash-book', 'categories'], queryFn: () => cashBookApi.categories(), enabled: open });
  const set = (patch: Partial<CashBookFilters>) => setLocal((p) => ({ ...p, ...patch }));
  const pick = (v: string) => (v === ALL ? undefined : v);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6"><SheetTitle>Bộ lọc sổ quỹ</SheetTitle></SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <Label>Thời gian</Label>
            <Select value={local.preset} onValueChange={(v) => { const p = v as DatePreset; set({ preset: p, ...(p === 'custom' ? {} : presetRange(p)) }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DATE_PRESET_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="cb-from">Từ ngày</Label><Input id="cb-from" type="date" value={local.from} onChange={(e) => set({ preset: 'custom', from: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="cb-to">Đến ngày</Label><Input id="cb-to" type="date" value={local.to} onChange={(e) => set({ preset: 'custom', to: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Chi nhánh</Label>
            <Select value={local.storeId ?? ALL} onValueChange={(v) => set({ storeId: pick(v), accountId: undefined })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả chi nhánh</SelectItem>
                {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tài khoản quỹ</Label>
            <div className="flex gap-2">
              <div className="flex-1"><AccountSelect value={local.accountId} onChange={(v) => set({ accountId: v })} storeId={local.storeId} placeholder="Tất cả tài khoản" /></div>
              {local.accountId && <Button variant="ghost" onClick={() => set({ accountId: undefined })}>Bỏ</Button>}
            </div>
            <p className="text-xs text-muted-foreground">Chọn một tài khoản để xem tồn đầu kỳ, tồn cuối kỳ và tồn quỹ theo từng phiếu.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Loại phiếu</Label>
              <Select value={local.direction ?? ALL} onValueChange={(v) => set({ direction: pick(v) as CashBookFilters['direction'], categoryId: undefined })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>Thu và chi</SelectItem><SelectItem value="in">Phiếu thu</SelectItem><SelectItem value="out">Phiếu chi</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={local.status ?? ALL} onValueChange={(v) => set({ status: pick(v) as CashBookFilters['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>Tất cả</SelectItem><SelectItem value="posted">Đã ghi sổ</SelectItem><SelectItem value="cancelled">Đã hủy</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Loại thu chi</Label>
            <Select value={local.categoryId ?? ALL} onValueChange={(v) => set({ categoryId: pick(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả</SelectItem>
                {categories.filter((c) => !local.direction || c.direction === local.direction).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.direction === 'in' ? 'Thu' : 'Chi'} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Đối tượng</Label>
              <Select value={local.counterpartyType ?? ALL} onValueChange={(v) => set({ counterpartyType: pick(v) as CashBookFilters['counterpartyType'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>Tất cả</SelectItem>{Object.entries(COUNTERPARTY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nguồn</Label>
              <Select value={local.sourceType ?? ALL} onValueChange={(v) => set({ sourceType: pick(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>Tất cả</SelectItem>{Object.entries(SOURCE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cb-cp">Tên người nộp / nhận</Label>
            <Input id="cb-cp" value={local.counterparty ?? ''} onChange={(e) => set({ counterparty: e.target.value || undefined })} />
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
