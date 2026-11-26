import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PROMOTION_TYPE_LABELS, promotionError, promotionsApi, type PromotionInput, type PromotionType } from '@/lib/api/promotions';
import { ConditionFields, type Conditions } from './ConditionFields';
import { fromLocalInput, toLocalInput } from './datetime';
import { PromotionRuleFields } from './PromotionRuleFields';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this promotion; create when null. */
  promotionId: string | null;
}

const empty = (): PromotionInput => ({ code: '', name: '', type: 'line_discount', priority: 0, is_active: true, combinable: true, discount_kind: 'percent', targets: [] });

/** Create or edit a promotion: type and rule, conditions, combination. */
export function PromotionFormSheet({ open, onOpenChange, promotionId }: Props) {
  const queryClient = useQueryClient();
  const { data: existing } = useQuery({ queryKey: ['promotions', promotionId], queryFn: () => promotionsApi.get(promotionId!), enabled: open && !!promotionId });
  const [form, setForm] = useState<PromotionInput>(empty);
  const [cond, setCond] = useState<Conditions>({ start_at: '', end_at: '', store_ids: [], group_ids: [], channels: [], days_of_week: [] });
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (promotionId && !existing) return;
    const p = existing;
    setForm(p ? { ...p } : empty());
    setNames(p?.target_names ?? {});
    setCond({
      start_at: toLocalInput(p?.start_at), end_at: toLocalInput(p?.end_at),
      days_of_week: p?.days_of_week ?? [], time_from: p?.time_from ?? '', time_to: p?.time_to ?? '',
      store_ids: p?.stores.map((s) => s.id) ?? [], group_ids: p?.groups.map((g) => g.id) ?? [], channels: p?.channels ?? [],
    });
  }, [open, promotionId, existing]);

  const set = (patch: Partial<PromotionInput>) => setForm((f) => ({ ...f, ...patch }));
  const save = useMutation({
    mutationFn: () => {
      const dto: PromotionInput = {
        ...form,
        code: promotionId ? undefined : form.code?.trim().toUpperCase(),
        type: promotionId ? undefined : form.type,
        start_at: fromLocalInput(cond.start_at), end_at: fromLocalInput(cond.end_at),
        days_of_week: cond.days_of_week, time_from: cond.time_from || null, time_to: cond.time_to || null,
        store_ids: cond.store_ids, group_ids: cond.group_ids, channels: cond.channels,
      };
      return promotionId ? promotionsApi.update(promotionId, dto) : promotionsApi.create(dto);
    },
    onSuccess: () => { toast.success('Đã lưu khuyến mãi'); void queryClient.invalidateQueries({ queryKey: ['promotions'] }); onOpenChange(false); },
    onError: (e) => toast.error(promotionError(e).message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>{promotionId ? `Sửa ${existing?.name ?? ''}` : 'Thêm khuyến mãi'}</SheetTitle>
          <SheetDescription>Khuyến mãi tự áp dụng khi đủ điều kiện; mỗi dòng hàng nhận một khuyến mãi tốt nhất.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <div className="space-y-2"><Label htmlFor="pm-code">Mã</Label><Input id="pm-code" value={form.code ?? ''} disabled={!!promotionId} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="MUA2TANG1" /></div>
            <div className="space-y-2"><Label htmlFor="pm-name">Tên</Label><Input id="pm-name" value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Loại</Label>
            <Select value={form.type} disabled={!!promotionId} onValueChange={(t) => set({ type: t as PromotionType, targets: [], discount_kind: t === 'line_discount' || t === 'order_discount' ? 'percent' : null })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PROMOTION_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <PromotionRuleFields value={form} onChange={set} names={names} onNames={setNames} />
          <Separator />
          <ConditionFields value={cond} onChange={(p) => setCond((c) => ({ ...c, ...p }))} />
          <Separator />
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div><Label htmlFor="pm-comb">Cho phép kết hợp</Label><p className="text-xs text-muted-foreground">Tắt: không dùng cùng khuyến mãi cấp khác (hàng hóa ↔ đơn hàng); hệ thống chọn bên có lợi hơn cho khách.</p></div>
              <Switch id="pm-comb" checked={form.combinable ?? true} onCheckedChange={(v) => set({ combinable: v })} />
            </div>
            <div className="grid grid-cols-[1fr_8rem] items-center gap-3">
              <Label htmlFor="pm-prio">Ưu tiên khi bằng giá trị giảm</Label>
              <Input id="pm-prio" type="number" value={form.priority ?? 0} onChange={(e) => set({ priority: Number(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center justify-between"><Label htmlFor="pm-active">Đang áp dụng</Label><Switch id="pm-active" checked={form.is_active ?? true} onCheckedChange={(v) => set({ is_active: v })} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="pm-notes">Ghi chú</Label><Textarea id="pm-notes" rows={2} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!form.name?.trim() || (!promotionId && !form.code?.trim()) || save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
