import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PromotionFormSheet } from '@/components/promotions/PromotionFormSheet';
import { periodText, statusOf } from '@/components/promotions/datetime';
import { DAY_LABELS, PROMOTION_TYPE_LABELS, promotionError, promotionsApi, type Promotion } from '@/lib/api/promotions';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';

const ruleText = (p: Promotion) => {
  if (p.type === 'buy_x_get_y') return `Mua ${p.buy_quantity} tặng ${p.get_quantity}${p.get_discount_percent === 100 ? '' : ` giảm ${p.get_discount_percent}%`}`;
  if (p.type === 'bundle') return `Combo ${formatCurrency(p.bundle_price ?? 0)}`;
  const v = p.discount_kind === 'percent' ? `${p.discount_value}%` : formatCurrency(p.discount_value ?? 0);
  const base = p.discount_kind === 'fixed_price' ? `Đồng giá ${v}` : `Giảm ${v}`;
  return p.type === 'order_discount' && p.min_order_amount ? `${base} đơn từ ${formatCurrency(p.min_order_amount)}` : base;
};
const whenText = (p: Promotion) =>
  [p.days_of_week?.length ? p.days_of_week.map((d) => DAY_LABELS[d]).join(', ') : '', p.time_from ? `${p.time_from}–${p.time_to ?? '24:00'}` : ''].filter(Boolean).join(' · ');

/** Khuyến mãi: all promotions with status, rule, conditions and usage. */
export function PromotionsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { data: promotions, isLoading } = useQuery({ queryKey: ['promotions'], queryFn: promotionsApi.list });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['promotions'] });
  const onError = (e: unknown) => toast.error(promotionError(e).message);
  const toggle = useMutation({ mutationFn: (p: Promotion) => promotionsApi.update(p.id, { is_active: !p.is_active }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (p: Promotion) => promotionsApi.remove(p.id), onSuccess: () => { toast.success('Đã xóa'); refresh(); }, onError });
  const open = (id: string | null) => { setEditing(id); setFormOpen(true); };
  const canEdit = can('promotions', 'update');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Khuyến mãi</h1>
          <p className="text-sm text-muted-foreground">Tự áp dụng ở POS và đơn hàng theo thứ tự: giá → giảm dòng → khuyến mãi → giảm đơn → voucher → điểm.</p>
        </div>
        {can('promotions', 'create') && <Button onClick={() => open(null)}><Plus className="h-4 w-4" /> Thêm khuyến mãi</Button>}
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khuyến mãi</TableHead><TableHead>Ưu đãi</TableHead><TableHead>Thời gian</TableHead><TableHead>Áp dụng</TableHead>
                <TableHead className="text-right">Đơn / đã giảm</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions?.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Chưa có khuyến mãi</TableCell></TableRow>}
              {promotions?.map((p) => {
                const st = statusOf(p);
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => open(p.id)}>
                    <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.code} · {PROMOTION_TYPE_LABELS[p.type]}{p.combinable ? '' : ' · không kết hợp'}</div></TableCell>
                    <TableCell className="text-sm">{ruleText(p)}{p.max_discount ? ` (tối đa ${formatCurrency(p.max_discount)})` : ''}</TableCell>
                    <TableCell className="text-sm">{periodText(p.start_at, p.end_at)}{whenText(p) && <div className="text-xs text-muted-foreground">{whenText(p)}</div>}</TableCell>
                    <TableCell className="text-sm">{p.all_stores ? 'Mọi chi nhánh' : p.stores.map((s) => s.name).join(', ')}<div className="text-xs text-muted-foreground">{p.all_customers ? 'Mọi khách' : p.groups.map((g) => g.name).join(', ')}</div></TableCell>
                    <TableCell className="text-right tabular-nums">{p.usage.orders}<div className="text-xs text-muted-foreground">{formatCurrency(p.usage.discount)}</div></TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {canEdit && <Switch checked={p.is_active} aria-label="Đang áp dụng" disabled={toggle.isPending} onCheckedChange={() => toggle.mutate(p)} />}
                        {can('promotions', 'delete') && p.usage.orders === 0 && <Button size="icon" variant="ghost" aria-label="Xóa" onClick={() => remove.mutate(p)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <PromotionFormSheet open={formOpen} onOpenChange={setFormOpen} promotionId={editing} />
    </div>
  );
}
