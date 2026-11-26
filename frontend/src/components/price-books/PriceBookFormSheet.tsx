import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { customerGroupsApi } from '@/lib/api/customer-groups';
import { priceBookError, priceBooksApi, type PriceBook } from '@/lib/api/price-books';
import { storesApi } from '@/lib/api/stores';

interface PriceBookFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this book; create when null. */
  book: PriceBook | null;
  onSaved?: (book: PriceBook) => void;
}

/** `YYYY-MM-DDTHH:mm` in local time for datetime-local inputs. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

interface FormState {
  code: string;
  name: string;
  priority: string;
  is_active: boolean;
  start_at: string;
  end_at: string;
  store_ids: string[];
  group_ids: string[];
  allow_manual: boolean;
  notes: string;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Create or edit a price book: dates, priority, branch and customer-group conditions, manual choice. */
export function PriceBookFormSheet({ open, onOpenChange, book, onSaved }: PriceBookFormSheetProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>();
  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: open });
  const { data: groups = [] } = useQuery({ queryKey: ['customer-groups'], queryFn: customerGroupsApi.list, enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm({
      code: book?.code ?? '',
      name: book?.name ?? '',
      priority: String(book?.priority ?? 0),
      is_active: book?.is_active ?? true,
      start_at: toLocalInput(book?.start_at ?? null),
      end_at: toLocalInput(book?.end_at ?? null),
      store_ids: book?.stores.map((s) => s.id) ?? [],
      group_ids: book?.groups.map((g) => g.id) ?? [],
      allow_manual: book?.allow_manual ?? false,
      notes: book?.notes ?? '',
    });
  }, [open, book]);

  const save = useMutation({
    mutationFn: () => {
      const f = form!;
      const dto = {
        name: f.name.trim(),
        priority: Number(f.priority) || 0,
        is_active: f.is_active,
        start_at: fromLocalInput(f.start_at),
        end_at: fromLocalInput(f.end_at),
        store_ids: f.store_ids,
        group_ids: f.group_ids,
        allow_manual: f.allow_manual,
        notes: f.notes || undefined,
      };
      return book ? priceBooksApi.update(book.id, dto) : priceBooksApi.create({ ...dto, code: f.code.trim().toUpperCase() });
    },
    onSuccess: (saved) => {
      toast.success(book ? 'Đã cập nhật bảng giá' : 'Đã tạo bảng giá');
      void queryClient.invalidateQueries({ queryKey: ['price-books'] });
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (e) => toast.error(priceBookError(e).message),
  });

  if (!form) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>{book ? `Sửa ${book.name}` : 'Thêm bảng giá'}</SheetTitle>
          <SheetDescription>Bảng giá thay giá bán chung cho các chi nhánh và nhóm khách hàng đã chọn, trong khoảng thời gian hiệu lực.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <div className="grid grid-cols-[10rem_1fr_7rem] gap-3">
            <div className="space-y-2"><Label htmlFor="pb-code">Mã</Label><Input id="pb-code" value={form.code} disabled={!!book} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="GIA-SI" /></div>
            <div className="space-y-2"><Label htmlFor="pb-name">Tên</Label><Input id="pb-name" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="pb-priority">Ưu tiên</Label><Input id="pb-priority" type="number" value={form.priority} onChange={(e) => set({ priority: e.target.value })} /></div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">Khi nhiều bảng giá cùng áp dụng cho một mặt hàng, bảng có độ ưu tiên cao hơn được dùng.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="pb-start">Bắt đầu (để trống = ngay)</Label><Input id="pb-start" type="datetime-local" value={form.start_at} onChange={(e) => set({ start_at: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="pb-end">Kết thúc (để trống = không hạn)</Label><Input id="pb-end" type="datetime-local" value={form.end_at} onChange={(e) => set({ end_at: e.target.value })} /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Chi nhánh áp dụng</legend>
            <p className="text-xs text-muted-foreground">Không chọn chi nhánh nào = mọi chi nhánh.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {stores.map((s) => (
                <Label key={s.id} className="flex items-center gap-2 rounded-md border p-2 font-normal">
                  <Checkbox checked={form.store_ids.includes(s.id)} onCheckedChange={() => set({ store_ids: toggle(form.store_ids, s.id) })} />
                  {s.name}
                </Label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Nhóm khách hàng áp dụng</legend>
            <p className="text-xs text-muted-foreground">Không chọn nhóm nào = mọi khách hàng, kể cả khách lẻ.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {groups.map((g) => (
                <Label key={g.id} className="flex items-center gap-2 rounded-md border p-2 font-normal">
                  <Checkbox checked={form.group_ids.includes(g.id)} onCheckedChange={() => set({ group_ids: toggle(form.group_ids, g.id) })} />
                  {g.name}{!g.is_active && <span className="text-xs text-muted-foreground">(ngừng dùng)</span>}
                </Label>
              ))}
              {groups.length === 0 && <p className="text-sm text-muted-foreground">Chưa có nhóm khách hàng.</p>}
            </div>
          </fieldset>
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div><Label htmlFor="pb-manual">Cho phép chọn tay khi bán</Label><p className="text-xs text-muted-foreground">Nhân viên có quyền có thể chọn bảng giá này cho cả đơn, bất kể nhóm khách hàng.</p></div>
              <Switch id="pb-manual" checked={form.allow_manual} onCheckedChange={(v) => set({ allow_manual: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pb-active">Đang áp dụng</Label>
              <Switch id="pb-active" checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="pb-notes">Ghi chú</Label><Textarea id="pb-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!form.name.trim() || (!book && !form.code.trim()) || save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
