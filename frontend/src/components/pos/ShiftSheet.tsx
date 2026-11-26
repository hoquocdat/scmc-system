import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { AccountSelect } from '@/components/cash-book/AccountSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { CURRENT_SHIFT_KEY, POS_PAYMENT_METHOD_LABELS, posApi, type PosPaymentMethod, type PosShift } from '@/lib/api/pos';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { printElement } from '@/lib/utils/print';

interface ShiftSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: PosShift;
  onClosed: () => void;
}

/** Cash in/out, the running shift summary, and closing with the counted cash. */
export function ShiftSheet({ open, onOpenChange, shift, onClosed }: ShiftSheetProps) {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const summary = useQuery({ queryKey: ['pos', 'shift', shift.id, 'summary'], queryFn: () => posApi.getShiftSummary(shift.id), enabled: open, refetchInterval: 30_000 });

  const [moveType, setMoveType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [moveAmount, setMoveAmount] = useState<number | undefined>(undefined);
  const [moveReason, setMoveReason] = useState('');
  const [moveAccountId, setMoveAccountId] = useState<string>();
  const [closingCash, setClosingCash] = useState<number | undefined>(undefined);
  const [confirmClose, setConfirmClose] = useState(false);

  const errMsg = (error: unknown) => (axios.isAxiosError(error) ? (error.response?.data?.message ?? error.message) : 'Lỗi');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pos', 'shift', shift.id, 'summary'] });

  const moveMutation = useMutation({
    mutationFn: () => posApi.addCashMovement({ pos_session_id: shift.id, transaction_type: moveType, amount: moveAmount ?? 0, reason: moveReason, target_account_id: moveAccountId }),
    onSuccess: () => {
      toast.success(moveType === 'cash_in' ? 'Đã ghi nhận nộp tiền vào két' : 'Đã ghi nhận rút tiền khỏi két');
      setMoveAmount(undefined);
      setMoveReason('');
      setMoveAccountId(undefined);
      void refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const closeMutation = useMutation({
    mutationFn: () => posApi.closeShift(shift.id, { closing_cash: closingCash ?? 0 }),
    onSuccess: (closed) => {
      toast.success(`Đã đóng ca ${closed.session_number}. Chênh lệch ${formatCurrency(Number(closed.cash_difference ?? 0))}`);
      void queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_KEY });
      onClosed();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const s = summary.data;
  const difference = s && closingCash != null ? closingCash - s.expected_cash : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Ca {shift.session_number}</SheetTitle>
          <SheetDescription>{shift.stores?.name} · mở lúc {formatDateTime(shift.opened_at)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          <div ref={printRef} className="space-y-2 text-sm">
            <h3 className="font-semibold">Tổng kết ca</h3>
            {s && (
              <Table>
                <TableBody>
                  <Line label="Số đơn" value={String(s.sales_count)} />
                  <Line label="Doanh số" value={formatCurrency(s.sales_total)} />
                  {s.by_payment_method.map((m) => (
                    <Line key={m.method} label={`  ${POS_PAYMENT_METHOD_LABELS[m.method as PosPaymentMethod] ?? m.method} (${m.payments})`} value={formatCurrency(m.amount)} muted />
                  ))}
                  {s.credit_given > 0 && <Line label="Bán nợ" value={formatCurrency(s.credit_given)} />}
                  <Line label="Tiền đầu ca" value={formatCurrency(s.opening_cash)} />
                  <Line label="Tiền mặt bán hàng" value={formatCurrency(s.cash_received)} />
                  <Line label="Nộp vào két" value={formatCurrency(s.cash_in)} />
                  <Line label="Rút khỏi két" value={`-${formatCurrency(s.cash_out)}`} />
                  <Line label="Tiền mặt dự kiến" value={formatCurrency(s.expected_cash)} strong />
                </TableBody>
              </Table>
            )}
            {s?.movements.length ? (
              <div className="text-xs text-muted-foreground">
                {s.movements.map((m) => (
                  <div key={m.id} className="flex justify-between">
                    <span>{formatDateTime(m.created_at)} · {m.reason}</span>
                    <span className="tabular-nums">{formatCurrency(Number(m.amount))}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => printRef.current && void printElement(printRef.current, { title: `Ca ${shift.session_number}`, paperSize: '80mm' })}>
            <Printer className="h-4 w-4" /> In tổng kết
          </Button>

          <Separator />
          <div className="space-y-2">
            <h3 className="font-semibold">Thu / chi tiền mặt</h3>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Select value={moveType} onValueChange={(v) => setMoveType(v as 'cash_in' | 'cash_out')}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_in">Nộp vào</SelectItem>
                  <SelectItem value="cash_out">Rút ra</SelectItem>
                </SelectContent>
              </Select>
              <CurrencyInput aria-label="Số tiền" value={moveAmount} onValueChange={setMoveAmount} />
            </div>
            <Input placeholder="Lý do (bắt buộc)" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
            {shift.store_id && (
              <AccountSelect
                storeId={shift.store_id}
                value={moveAccountId}
                onChange={setMoveAccountId}
                allowDefault
                excludeDrawer
                defaultLabel={moveType === 'cash_in' ? 'Nộp từ bên ngoài' : 'Rút ra ngoài (chi)'}
                placeholder={moveType === 'cash_in' ? 'Lấy từ tài khoản' : 'Chuyển vào tài khoản'}
              />
            )}
            <Button size="sm" disabled={!moveAmount || !moveReason || moveMutation.isPending} onClick={() => moveMutation.mutate()}>Ghi nhận</Button>
          </div>

          <Separator />
          <div className="space-y-2">
            <h3 className="font-semibold">Đóng ca</h3>
            <Label htmlFor="closing-cash">Tiền mặt kiểm đếm</Label>
            <CurrencyInput id="closing-cash" value={closingCash} onValueChange={setClosingCash} />
            {difference !== null && (
              <p className={`text-sm ${difference === 0 ? 'text-muted-foreground' : difference < 0 ? 'text-destructive' : 'text-amber-700'}`}>
                Chênh lệch so với dự kiến: {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          {!confirmClose ? (
            <Button variant="destructive" disabled={closingCash == null} onClick={() => setConfirmClose(true)}>Đóng ca</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirmClose(false)}>Quay lại</Button>
              <Button variant="destructive" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()}>Xác nhận đóng ca</Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <TableRow className={muted ? 'text-muted-foreground' : strong ? 'font-semibold' : undefined}>
      <TableCell className="py-1 whitespace-pre">{label}</TableCell>
      <TableCell className="py-1 text-right tabular-nums">{value}</TableCell>
    </TableRow>
  );
}
