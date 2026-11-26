import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ConditionFields, type Conditions } from '@/components/promotions/ConditionFields';
import { fromLocalInput, toLocalInput } from '@/components/promotions/datetime';
import { promotionError } from '@/lib/api/promotions';
import { vouchersApi, type CampaignInput, type VoucherCampaign } from '@/lib/api/vouchers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: VoucherCampaign | null;
  onSaved?: (c: VoucherCampaign) => void;
}

/** Create or edit a voucher campaign: value, minimum, limits, validity. */
export function CampaignFormSheet({ open, onOpenChange, campaign, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [f, setF] = useState<CampaignInput>({});
  const [cond, setCond] = useState<Conditions>({ start_at: '', end_at: '', store_ids: [], channels: [] });
  const set = (p: Partial<CampaignInput>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (!open) return;
    const c = campaign;
    setF(c ? { ...c } : { code: '', name: '', discount_kind: 'percent', discount_value: 10, uses_per_code: 1, combinable_with_promotions: true, is_active: true });
    setCond({ start_at: toLocalInput(c?.start_at), end_at: toLocalInput(c?.end_at), store_ids: c?.stores.map((s) => s.id) ?? [], channels: c?.channels ?? [] });
  }, [open, campaign]);

  const save = useMutation({
    mutationFn: () => {
      const dto: CampaignInput = {
        code: campaign ? undefined : f.code?.trim().toUpperCase(),
        name: f.name, discount_kind: f.discount_kind, discount_value: f.discount_value,
        max_discount: f.discount_kind === 'percent' ? (f.max_discount ?? null) : null,
        min_order_amount: f.min_order_amount ?? null, uses_per_code: f.uses_per_code, uses_per_customer: f.uses_per_customer ?? null,
        combinable_with_promotions: f.combinable_with_promotions, is_active: f.is_active, notes: f.notes ?? undefined,
        start_at: fromLocalInput(cond.start_at), end_at: fromLocalInput(cond.end_at), store_ids: cond.store_ids, channels: cond.channels,
      };
      return campaign ? vouchersApi.update(campaign.id, dto) : vouchersApi.create(dto);
    },
    onSuccess: (c) => { toast.success('Đã lưu chương trình'); void queryClient.invalidateQueries({ queryKey: ['vouchers'] }); onOpenChange(false); onSaved?.(c); },
    onError: (e) => toast.error(promotionError(e).message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6"><SheetTitle>{campaign ? `Sửa ${campaign.name}` : 'Thêm chương trình voucher'}</SheetTitle></SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <div className="space-y-2"><Label htmlFor="vc-code">Mã chương trình</Label><Input id="vc-code" value={f.code ?? ''} disabled={!!campaign} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="TET27" /></div>
            <div className="space-y-2"><Label htmlFor="vc-name">Tên</Label><Input id="vc-name" value={f.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <div className="space-y-2">
              <Label>Giá trị</Label>
              <Select value={f.discount_kind} onValueChange={(k) => set({ discount_kind: k as 'percent' | 'amount' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percent">Giảm %</SelectItem><SelectItem value="amount">Giảm tiền</SelectItem></SelectContent>
              </Select>
            </div>
            {f.discount_kind === 'percent' ? (
              <div className="space-y-2"><Label>Phần trăm</Label><Input type="number" min={1} max={100} value={f.discount_value ?? ''} onChange={(e) => set({ discount_value: Number(e.target.value) })} /></div>
            ) : (
              <div className="space-y-2"><Label>Số tiền</Label><CurrencyInput value={f.discount_value ?? undefined} onValueChange={(v) => set({ discount_value: v })} /></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {f.discount_kind === 'percent' && <div className="space-y-2"><Label>Giảm tối đa</Label><CurrencyInput value={f.max_discount ?? undefined} onValueChange={(v) => set({ max_discount: v ?? null })} /></div>}
            <div className="space-y-2"><Label>Đơn tối thiểu</Label><CurrencyInput value={f.min_order_amount ?? undefined} onValueChange={(v) => set({ min_order_amount: v ?? null })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="vc-upc">Lượt dùng mỗi mã</Label><Input id="vc-upc" type="number" min={1} value={f.uses_per_code ?? 1} onChange={(e) => set({ uses_per_code: Math.max(1, Number(e.target.value) || 1) })} /></div>
            <div className="space-y-2"><Label htmlFor="vc-upk">Lượt mỗi khách (để trống = không giới hạn)</Label><Input id="vc-upk" type="number" min={1} value={f.uses_per_customer ?? ''} onChange={(e) => set({ uses_per_customer: e.target.value ? Math.max(1, Number(e.target.value)) : null })} /></div>
          </div>
          <Separator />
          <ConditionFields simple value={cond} onChange={(p) => setCond((c) => ({ ...c, ...p }))} />
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3"><Label htmlFor="vc-comb">Dùng chung với khuyến mãi</Label><Switch id="vc-comb" checked={f.combinable_with_promotions ?? true} onCheckedChange={(v) => set({ combinable_with_promotions: v })} /></div>
            <div className="flex items-center justify-between gap-3"><Label htmlFor="vc-active">Đang áp dụng</Label><Switch id="vc-active" checked={f.is_active ?? true} onCheckedChange={(v) => set({ is_active: v })} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="vc-notes">Ghi chú</Label><Textarea id="vc-notes" rows={2} value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!f.name?.trim() || (!campaign && !f.code?.trim()) || !f.discount_value || save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
