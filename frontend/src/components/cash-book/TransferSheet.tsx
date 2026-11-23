import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cashBookApi, cashBookError } from '@/lib/api/cash-book';
import { AccountSelect } from './AccountSelect';

interface TransferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Move money between two accounts (drawer → safe, safe → bank, …). */
export function TransferSheet({ open, onOpenChange }: TransferSheetProps) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [amount, setAmount] = useState<number>();
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setAmount(undefined); setNote(''); } }, [open]);

  const mutation = useMutation({
    mutationFn: () => cashBookApi.createTransfer({ from_account_id: from!, to_account_id: to!, amount: amount!, note: note || undefined }),
    onSuccess: () => {
      toast.success('Đã chuyển quỹ');
      void queryClient.invalidateQueries({ queryKey: ['cash-book'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(cashBookError(e)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Chuyển quỹ</SheetTitle>
          <SheetDescription>Tạo một phiếu chi ở tài khoản nguồn và một phiếu thu ở tài khoản đích.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2"><Label>Từ tài khoản</Label><AccountSelect value={from} onChange={setFrom} exclude={to ? [to] : []} showBalance /></div>
          <div className="space-y-2"><Label>Đến tài khoản</Label><AccountSelect value={to} onChange={setTo} exclude={from ? [from] : []} showBalance /></div>
          <div className="space-y-2"><Label htmlFor="t-amount">Số tiền</Label><CurrencyInput id="t-amount" value={amount} onValueChange={setAmount} /></div>
          <div className="space-y-2"><Label htmlFor="t-note">Diễn giải</Label><Textarea id="t-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!from || !to || !amount || from === to || mutation.isPending} onClick={() => mutation.mutate()}>Chuyển quỹ</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
