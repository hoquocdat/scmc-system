import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ACCOUNT_TYPE_LABELS, cashBookApi, cashBookError, type CashAccount, type CashAccountType } from '@/lib/api/cash-book';
import { storesApi } from '@/lib/api/stores';

interface AccountFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this account; create a new one when null. */
  account: CashAccount | null;
}

/** Create or edit a cash, bank or e-wallet account. Branch, code and type are fixed after creation. */
export function AccountFormSheet({ open, onOpenChange, account }: AccountFormSheetProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ store_id: '', code: '', name: '', type: 'cash' as CashAccountType, is_pos_drawer: false, bank_name: '', account_number: '', notes: '' });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm({
      store_id: account?.store_id ?? '',
      code: account?.code ?? '',
      name: account?.name ?? '',
      type: account?.type ?? 'cash',
      is_pos_drawer: account?.is_pos_drawer ?? false,
      bank_name: account?.bank_name ?? '',
      account_number: account?.account_number ?? '',
      notes: account?.notes ?? '',
    });
  }, [open, account]);

  const mutation = useMutation({
    mutationFn: () => {
      const common = { name: form.name, is_pos_drawer: form.is_pos_drawer, bank_name: form.bank_name || undefined, account_number: form.account_number || undefined, notes: form.notes || undefined };
      return account ? cashBookApi.updateAccount(account.id, common) : cashBookApi.createAccount({ ...common, store_id: form.store_id, code: form.code, type: form.type });
    },
    onSuccess: () => {
      toast.success(account ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản');
      void queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(cashBookError(e)),
  });

  const valid = form.name.trim() && (account || (form.store_id && form.code.trim()));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6"><SheetTitle>{account ? `Sửa ${account.name}` : 'Thêm tài khoản quỹ'}</SheetTitle></SheetHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2">
            <Label>Chi nhánh</Label>
            <Select value={form.store_id} onValueChange={(v) => set({ store_id: v })} disabled={!!account}>
              <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
              <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="acc-code">Mã</Label><Input id="acc-code" value={form.code} disabled={!!account} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="HCM-SAFE" /></div>
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select value={form.type} onValueChange={(v) => set({ type: v as CashAccountType, is_pos_drawer: v === 'cash' && form.is_pos_drawer })} disabled={!!account}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ACCOUNT_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="acc-name">Tên</Label><Input id="acc-name" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          {form.type !== 'cash' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="acc-bank">{form.type === 'bank' ? 'Ngân hàng' : 'Nhà cung cấp ví'}</Label><Input id="acc-bank" value={form.bank_name} onChange={(e) => set({ bank_name: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="acc-no">Số tài khoản</Label><Input id="acc-no" value={form.account_number} onChange={(e) => set({ account_number: e.target.value })} /></div>
            </div>
          )}
          {form.type === 'cash' && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="acc-drawer">Két quầy POS</Label>
                <p className="text-xs text-muted-foreground">Tiền mặt bán hàng và thu chi trong ca ghi vào tài khoản này. Mỗi chi nhánh chỉ có một.</p>
              </div>
              <Switch id="acc-drawer" checked={form.is_pos_drawer} onCheckedChange={(v) => set({ is_pos_drawer: v })} />
            </div>
          )}
          <div className="space-y-2"><Label htmlFor="acc-notes">Ghi chú</Label><Textarea id="acc-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>Lưu</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
