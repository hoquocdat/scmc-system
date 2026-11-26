import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountSelect } from '@/components/cash-book/AccountSelect';
import type { MarkPaidDto } from '@/lib/api/payroll';

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dto: MarkPaidDto) => void;
  isPending?: boolean;
}

/** Pay a payroll period: method, cash book account (one payment entry per slip) and reference. */
export function MarkPaidDialog({ open, onOpenChange, onConfirm, isPending }: MarkPaidDialogProps) {
  const [method, setMethod] = useState('bank_transfer');
  const [accountId, setAccountId] = useState<string>();
  const [reference, setReference] = useState('');
  useEffect(() => { if (open) { setReference(''); setAccountId(undefined); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đánh dấu đã thanh toán</DialogTitle>
          <DialogDescription>Mỗi phiếu lương sẽ tạo một phiếu chi trong sổ quỹ từ tài khoản đã chọn.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Phương thức</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Chuyển khoản</SelectItem>
                <SelectItem value="cash">Tiền mặt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Chi từ tài khoản</Label><AccountSelect value={accountId} onChange={setAccountId} allowDefault showBalance /></div>
          <div className="space-y-2"><Label htmlFor="pay-ref">Mã giao dịch / tham chiếu</Label><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={isPending} onClick={() => onConfirm({ payment_method: method, cash_account_id: accountId, payment_reference: reference || undefined })}>
            {isPending ? 'Đang lưu…' : 'Xác nhận đã trả lương'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
