import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customerGroupsApi } from '@/lib/api/customer-groups';
import { CHANNEL_LABELS, DAY_LABELS } from '@/lib/api/promotions';
import { storesApi } from '@/lib/api/stores';

export interface Conditions {
  start_at: string;
  end_at: string;
  days_of_week?: number[];
  time_from?: string;
  time_to?: string;
  store_ids: string[];
  group_ids?: string[];
  channels: string[];
}

interface Props {
  value: Conditions;
  onChange: (patch: Partial<Conditions>) => void;
  /** Vouchers have no day/time window and no customer groups. */
  simple?: boolean;
}

const toggle = <T,>(list: T[] = [], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** When and where a promotion or voucher applies. Empty choices mean "all". */
export function ConditionFields({ value: v, onChange, simple }: Props) {
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll });
  const { data: groups = [] } = useQuery({ queryKey: ['customer-groups'], queryFn: customerGroupsApi.list, enabled: !simple });
  const box = (checked: boolean, onToggle: () => void, label: string, key: string) => (
    <Label key={key} className="flex items-center gap-2 rounded-md border px-2 py-1.5 font-normal">
      <Checkbox checked={checked} onCheckedChange={onToggle} />{label}
    </Label>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="c-start">Bắt đầu</Label><Input id="c-start" type="datetime-local" value={v.start_at} onChange={(e) => onChange({ start_at: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="c-end">Kết thúc</Label><Input id="c-end" type="datetime-local" value={v.end_at} onChange={(e) => onChange({ end_at: e.target.value })} /></div>
      </div>
      {!simple && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Ngày trong tuần <span className="font-normal text-muted-foreground">(không chọn = mọi ngày)</span></legend>
            <div className="flex flex-wrap gap-2">{DAY_LABELS.map((d, i) => box(!!v.days_of_week?.includes(i), () => onChange({ days_of_week: toggle(v.days_of_week, i) }), d, d))}</div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="c-from">Từ giờ</Label><Input id="c-from" type="time" value={v.time_from ?? ''} onChange={(e) => onChange({ time_from: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="c-to">Đến giờ</Label><Input id="c-to" type="time" value={v.time_to ?? ''} onChange={(e) => onChange({ time_to: e.target.value })} /></div>
          </div>
        </>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Chi nhánh <span className="font-normal text-muted-foreground">(không chọn = tất cả)</span></legend>
        <div className="flex flex-wrap gap-2">{stores.map((s) => box(v.store_ids.includes(s.id), () => onChange({ store_ids: toggle(v.store_ids, s.id) }), s.name, s.id))}</div>
      </fieldset>
      {!simple && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Nhóm khách hàng <span className="font-normal text-muted-foreground">(không chọn = mọi khách, kể cả khách lẻ)</span></legend>
          <div className="flex flex-wrap gap-2">{groups.filter((g) => g.is_active).map((g) => box(!!v.group_ids?.includes(g.id), () => onChange({ group_ids: toggle(v.group_ids, g.id) }), g.name, g.id))}</div>
        </fieldset>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Kênh bán <span className="font-normal text-muted-foreground">(không chọn = tất cả)</span></legend>
        <div className="flex flex-wrap gap-2">{Object.entries(CHANNEL_LABELS).map(([k, l]) => box(v.channels.includes(k), () => onChange({ channels: toggle(v.channels, k) }), l, k))}</div>
      </fieldset>
    </div>
  );
}
