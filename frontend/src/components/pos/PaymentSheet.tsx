import { useEffect, useMemo, useState } from 'react';
import { Plus, QrCode, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { QrPaymentDialog } from '@/components/qr/QrPaymentDialog';
import { POS_PAYMENT_METHOD_LABELS, type CheckoutPaymentDto, type PosPaymentMethod } from '@/lib/api/pos';
import { formatCurrency } from '@/lib/utils';

interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountDue: number;
  hasCustomer: boolean;
  isSubmitting: boolean;
  onComplete: (payments: CheckoutPaymentDto[]) => void;
  /** Customer's store credit (tiền trả hàng); the method is offered only when positive. */
  creditBalance?: number;
  /** For QR payments: branch, cart and shift. */
  storeId?: string | null;
  clientRequestId?: string;
  posSessionId?: string;
}

interface PaymentRow extends CheckoutPaymentDto {
  id: number;
}

const METHODS = Object.keys(POS_PAYMENT_METHOD_LABELS) as PosPaymentMethod[];
const toDto = ({ id, ...rest }: PaymentRow): CheckoutPaymentDto => {
  void id;
  return rest;
};
const CASH_QUICK = [20_000, 50_000, 100_000, 200_000, 500_000];

/**
 * One sheet for every payment method, with split payments. Cash takes the
 * amount tendered and shows the change; a remaining balance is a credit sale
 * (allowed for known customers with permission; the server enforces it).
 */
export function PaymentSheet({ open, onOpenChange, amountDue, hasCustomer, isSubmitting, onComplete, creditBalance = 0, storeId, clientRequestId, posSessionId }: PaymentSheetProps) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [qrRow, setQrRow] = useState<number | null>(null);

  useEffect(() => {
    // A QR payment already received stays on the sheet when it is reopened
    if (open) setRows((rs) => (rs.some((r) => r.qr_payment_request_id) ? rs : [{ id: 1, method: 'cash', amount: amountDue, amount_tendered: amountDue }]));
  }, [open, amountDue]);

  const paid = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows]);
  const remaining = Math.max(0, amountDue - paid);
  const over = Math.max(0, paid - amountDue);
  const cashRow = rows.find((r) => r.method === 'cash');
  const change = cashRow && cashRow.amount_tendered != null ? Math.max(0, cashRow.amount_tendered - cashRow.amount) : 0;
  const nonCashOver = rows.some((r) => r.method !== 'cash') && over > 0;
  const creditUsed = rows.filter((r) => r.method === 'store_credit').reduce((s, r) => s + (r.amount || 0), 0);
  const creditOver = creditUsed > creditBalance;
  const methods = METHODS.filter((m) => m !== 'store_credit' || creditBalance > 0);
  const canComplete = rows.every((r) => r.amount > 0 && (r.method !== 'cash' || (r.amount_tendered ?? 0) >= r.amount)) && !nonCashOver && !creditOver && (remaining === 0 || hasCustomer);

  const update = (id: number, patch: Partial<PaymentRow>) =>
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      if (next.method === 'cash' && patch.amount != null && (r.amount_tendered == null || r.amount_tendered === r.amount)) next.amount_tendered = patch.amount;
      if (next.method !== 'cash') next.amount_tendered = undefined;
      return next;
    }));
  const addRow = () => setRows((rs) => [...rs, { id: Date.now(), method: rs.some((r) => r.method === 'cash') ? 'card' : 'cash', amount: remaining }]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter' && canComplete && !isSubmitting) {
        e.preventDefault();
        onComplete(rows.map(toDto));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, canComplete, isSubmitting, rows, onComplete]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Thanh toán</SheetTitle>
          <SheetDescription>Khách cần trả <span className="font-semibold text-foreground">{formatCurrency(amountDue)}</span></SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 py-6">
          {rows.map((row, i) => (
            <div key={row.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Select value={row.method} disabled={!!row.qr_payment_request_id} onValueChange={(m) => update(row.id, { method: m as PosPaymentMethod })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m} value={m}>
                        {POS_PAYMENT_METHOD_LABELS[m]}{m === 'store_credit' ? ` · ${formatCurrency(creditBalance)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CurrencyInput aria-label="Số tiền" value={row.amount} disabled={!!row.qr_payment_request_id} onValueChange={(v) => update(row.id, { amount: v ?? 0 })} className="flex-1" />
                {storeId && row.method !== 'cash' && row.method !== 'store_credit' && !row.qr_payment_request_id && (
                  <Button type="button" variant="outline" size="sm" disabled={!(row.amount > 0)} onClick={() => setQrRow(row.id)}><QrCode className="h-4 w-4" /> QR</Button>
                )}
                {row.qr_payment_request_id && <Badge variant="default">QR đã nhận</Badge>}
                {rows.length > 1 && (
                  <Button variant="ghost" size="icon" aria-label="Bỏ dòng thanh toán" onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {row.method === 'cash' ? (
                <div className="space-y-2">
                  <Label htmlFor={`tendered-${row.id}`}>Khách đưa</Label>
                  <CurrencyInput id={`tendered-${row.id}`} value={row.amount_tendered} onValueChange={(v) => update(row.id, { amount_tendered: v })} autoFocus={i === 0} />
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => update(row.id, { amount_tendered: row.amount })}>Đủ</Button>
                    {CASH_QUICK.map((n) => (
                      <Button key={n} type="button" variant="outline" size="sm" onClick={() => update(row.id, { amount_tendered: (row.amount_tendered ?? 0) + n })}>+{(n / 1000).toLocaleString('vi-VN')}k</Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`ref-${row.id}`}>Mã tham chiếu / số giao dịch</Label>
                  <Input id={`ref-${row.id}`} value={row.reference ?? ''} disabled={!!row.qr_payment_request_id} onChange={(e) => update(row.id, { reference: e.target.value })} placeholder="Tùy chọn" />
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow} disabled={remaining === 0}>
            <Plus className="h-4 w-4" /> Thêm phương thức
          </Button>

          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Đã nhập</span><span className="tabular-nums">{formatCurrency(paid)}</span></div>
            {change > 0 && <div className="flex justify-between font-medium"><span>Tiền thối</span><span className="tabular-nums">{formatCurrency(change)}</span></div>}
            {remaining > 0 && (
              <div className="flex items-center justify-between text-amber-700">
                <span>Còn lại (bán nợ)</span>
                <span className="tabular-nums">{formatCurrency(remaining)}</span>
              </div>
            )}
            {remaining > 0 && !hasCustomer && <Badge variant="destructive">Khách lẻ phải thanh toán đủ</Badge>}
            {nonCashOver && <Badge variant="destructive">Thanh toán không phải tiền mặt vượt quá số tiền cần trả</Badge>}
            {creditOver && <Badge variant="destructive">Vượt số dư tiền trả hàng ({formatCurrency(creditBalance)})</Badge>}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Hủy</Button>
          <Button size="lg" disabled={!canComplete || isSubmitting} onClick={() => onComplete(rows.map(toDto))}>
            {isSubmitting ? 'Đang ghi nhận…' : 'Hoàn tất (Ctrl+Enter)'}
          </Button>
        </SheetFooter>
      </SheetContent>
      {storeId && qrRow !== null && (
        <QrPaymentDialog
          open
          onOpenChange={(o) => !o && setQrRow(null)}
          storeId={storeId}
          amount={rows.find((r) => r.id === qrRow)?.amount ?? 0}
          clientRequestId={clientRequestId}
          posSessionId={posSessionId}
          onPaid={(r) => update(qrRow, { method: r.method as PosPaymentMethod, amount: r.amount, reference: r.provider_ref ?? r.code, qr_payment_request_id: r.id })}
        />
      )}
    </Sheet>
  );
}
