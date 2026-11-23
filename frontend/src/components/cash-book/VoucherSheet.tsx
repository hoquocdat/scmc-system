import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { apiClient as legacyClient } from '@/lib/api-client';
import { cashBookApi, cashBookError, COUNTERPARTY_LABELS, type CashDirection, type CounterpartyType } from '@/lib/api/cash-book';
import { AccountSelect } from './AccountSelect';

/** Categories only automatic entries may use. */
const AUTOMATIC_ONLY = new Set(['sale', 'receivable_collection', 'workshop_service', 'shift_cash_in', 'shift_cash_out', 'opening_balance', 'transfer_in', 'transfer_out', 'cash_count_difference', 'reversal', 'supplier_payment', 'payroll']);

interface VoucherSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: CashDirection;
}

/** Manual receipt (phiếu thu) or payment (phiếu chi) voucher with optional attachments. */
export function VoucherSheet({ open, onOpenChange, direction }: VoucherSheetProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<string>();
  const [amount, setAmount] = useState<number>();
  const [categoryId, setCategoryId] = useState<string>();
  const [cpType, setCpType] = useState<CounterpartyType>('other');
  const [cpName, setCpName] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (open) {
      setAmount(undefined); setCategoryId(undefined); setCpName(''); setNote(''); setFiles([]); setDate('');
    }
  }, [open]);

  const { data: categories = [] } = useQuery({ queryKey: ['cash-book', 'categories'], queryFn: () => cashBookApi.categories(), enabled: open });
  const usable = categories.filter((c) => c.direction === direction && c.is_active && !AUTOMATIC_ONLY.has(c.code));

  const mutation = useMutation({
    mutationFn: async () => {
      const dto = { account_id: accountId!, amount: amount!, category_id: categoryId!, counterparty_type: cpType, counterparty_name: cpName || undefined, note: note || undefined, entry_date: date ? new Date(date).toISOString() : undefined };
      const entry = direction === 'in' ? await cashBookApi.createReceipt(dto) : await cashBookApi.createPayment(dto);
      if (files.length) await legacyClient.images.upload('cash_book_entry', entry.id, files);
      return entry;
    },
    onSuccess: (entry) => {
      toast.success(`Đã tạo ${direction === 'in' ? 'phiếu thu' : 'phiếu chi'} ${entry.entry_number}`);
      void queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(cashBookError(e)),
  });

  const title = direction === 'in' ? 'Lập phiếu thu' : 'Lập phiếu chi';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{direction === 'in' ? 'Thu khác ngoài bán hàng (hoàn tiền, thanh lý, …).' : 'Chi phí hoạt động (thuê mặt bằng, điện nước, …).'}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2"><Label>Tài khoản quỹ</Label><AccountSelect value={accountId} onChange={setAccountId} showBalance /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="v-amount">Số tiền</Label><CurrencyInput id="v-amount" value={amount} onValueChange={setAmount} /></div>
            <div className="space-y-2"><Label htmlFor="v-date">Thời gian (để trống = bây giờ)</Label><Input id="v-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Loại thu chi</Label>
            <Select value={categoryId ?? ''} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent>{usable.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <div className="space-y-2">
              <Label>Đối tượng</Label>
              <Select value={cpType} onValueChange={(v) => setCpType(v as CounterpartyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(COUNTERPARTY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="v-cp">{direction === 'in' ? 'Người nộp' : 'Người nhận'}</Label><Input id="v-cp" value={cpName} onChange={(e) => setCpName(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="v-note">Diễn giải</Label><Textarea id="v-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Chứng từ đính kèm</Label>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Chọn tệp</Button>
            {files.length > 0 && <p className="text-sm text-muted-foreground">{files.map((f) => f.name).join(', ')}</p>}
          </div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!accountId || !amount || !categoryId || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Đang lưu…' : title}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
