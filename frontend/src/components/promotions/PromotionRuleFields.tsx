import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DISCOUNT_KIND_LABELS, type DiscountKind, type PromotionInput, type PromotionTarget } from '@/lib/api/promotions';
import { TargetPicker } from './TargetPicker';

interface Props {
  value: PromotionInput;
  onChange: (patch: Partial<PromotionInput>) => void;
  names: Record<string, string>;
  onNames: (names: Record<string, string>) => void;
}

/** The type-specific part of a promotion: what is discounted and by how much. */
export function PromotionRuleFields({ value: v, onChange, names, onNames }: Props) {
  const targets = v.targets ?? [];
  const setTargets = (t: PromotionTarget[], n: Record<string, string>) => { onChange({ targets: t }); onNames(n); };
  const kinds: DiscountKind[] = v.type === 'order_discount' ? ['percent', 'amount'] : ['percent', 'amount', 'fixed_price'];
  const money = (key: keyof PromotionInput, label: string, hint?: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <CurrencyInput value={(v[key] as number | null | undefined) ?? undefined} onValueChange={(n) => onChange({ [key]: n ?? null })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  if (v.type === 'buy_x_get_y')
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2"><Label>Mua (số lượng)</Label><Input type="number" min={1} value={v.buy_quantity ?? ''} onChange={(e) => onChange({ buy_quantity: Number(e.target.value) || null })} /></div>
          <div className="space-y-2"><Label>Tặng (số lượng)</Label><Input type="number" min={1} value={v.get_quantity ?? ''} onChange={(e) => onChange({ get_quantity: Number(e.target.value) || null })} /></div>
          <div className="space-y-2"><Label>Giảm cho hàng tặng (%)</Label><Input type="number" min={1} max={100} value={v.get_discount_percent ?? ''} onChange={(e) => onChange({ get_discount_percent: Number(e.target.value) || null })} /></div>
        </div>
        <div className="space-y-2"><Label>Hàng phải mua</Label><TargetPicker role="buy" targets={targets} names={names} onChange={setTargets} /></div>
        <div className="space-y-2">
          <Label>Hàng được tặng</Label>
          <p className="text-xs text-muted-foreground">Để trống nếu tặng chính hàng phải mua (VD mua 2 tặng 1 cùng loại). Món rẻ nhất được tặng.</p>
          <TargetPicker role="get" targets={targets} names={names} onChange={setTargets} />
        </div>
      </div>
    );

  if (v.type === 'bundle')
    return (
      <div className="space-y-4">
        {money('bundle_price', 'Giá combo')}
        <div className="space-y-2"><Label>Thành phần combo (sản phẩm và số lượng)</Label><TargetPicker role="bundle" bundle targets={targets} names={names} onChange={setTargets} /></div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[12rem_1fr] gap-3">
        <div className="space-y-2">
          <Label>Cách giảm</Label>
          <Select value={v.discount_kind ?? ''} onValueChange={(k) => onChange({ discount_kind: k as DiscountKind })}>
            <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
            <SelectContent>{kinds.map((k) => <SelectItem key={k} value={k}>{DISCOUNT_KIND_LABELS[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {v.discount_kind === 'percent' ? (
          <div className="space-y-2"><Label>Phần trăm</Label><Input type="number" min={0} max={100} value={v.discount_value ?? ''} onChange={(e) => onChange({ discount_value: Number(e.target.value) })} /></div>
        ) : (
          money('discount_value', v.discount_kind === 'fixed_price' ? 'Giá bán còn' : 'Số tiền giảm mỗi sản phẩm')
        )}
      </div>
      {v.discount_kind === 'percent' && money('max_discount', 'Giảm tối đa', 'Để trống = không giới hạn')}
      {v.type === 'order_discount'
        ? money('min_order_amount', 'Đơn tối thiểu', 'Tính trên giá trị sau khuyến mãi hàng hóa')
        : <div className="space-y-2"><Label>Áp dụng cho</Label><TargetPicker role="target" targets={targets} names={names} onChange={setTargets} /></div>}
    </div>
  );
}
