import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Keyboard, Undo2, WifiOff, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CURRENT_SHIFT_KEY, posApi, type CheckoutDto, type CheckoutPaymentDto, type PosReceipt, type PosShift } from '@/lib/api/pos';
import { usePosCarts } from '@/hooks/usePosCarts';
import { usePosShortcuts } from '@/hooks/usePosShortcuts';
import { ApprovalDialog } from './ApprovalDialog';
import { CartLines } from './CartLines';
import { CartSummary } from './CartSummary';
import { CartTabs } from './CartTabs';
import { CustomerLookupDialog } from './CustomerLookupDialog';
import { PaymentSheet } from './PaymentSheet';
import { parsePosError } from './pos-errors';
import { ProductSearch } from './ProductSearch';
import { ReceiptDialog } from './ReceiptDialog';
import { ShiftSheet } from './ShiftSheet';
import { ShortcutsHelp } from './ShortcutsHelp';
import { ReturnSheet } from '@/components/returns/ReturnSheet';
import { ReturnDoneDialog } from '@/components/returns/ReturnDoneDialog';
import { salesReturnsApi, type SalesReturn } from '@/lib/api/sales-returns';

interface PosTerminalProps {
  shift: PosShift;
  userId: string;
}

export function PosTerminal({ shift, userId }: PosTerminalProps) {
  const queryClient = useQueryClient();
  const carts = usePosCarts(userId, shift.store_id ?? undefined);
  const { active: cart, totals } = carts;
  const searchRef = useRef<HTMLInputElement>(null);

  const [customerOpen, setCustomerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [approval, setApproval] = useState<{ requested: number; max: number; payments: CheckoutPaymentDto[] } | null>(null);
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returned, setReturned] = useState<SalesReturn | null>(null);
  const customerId = cart.customer?.id;
  const { data: credit } = useQuery({ queryKey: ['customers', customerId, 'credit'], queryFn: () => salesReturnsApi.customerCredit(customerId!), enabled: !!customerId });
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const buildDto = useCallback((payments: CheckoutPaymentDto[], token?: string): CheckoutDto => ({
    client_request_id: cart.client_request_id,
    customer_id: cart.customer?.id,
    new_customer: cart.new_customer ?? undefined,
    lines: cart.lines.map((l) => ({
      product_id: l.product_id,
      product_variant_id: l.product_variant_id ?? undefined,
      quantity: l.quantity,
      expected_unit_price: l.unit_price,
      discount_amount: l.discount_amount || undefined,
    })),
    order_discount: cart.order_discount ?? undefined,
    points_to_redeem: cart.points_to_redeem || undefined,
    price_book_id: cart.price_book_id ?? undefined,
    voucher_code: cart.voucher_code ?? undefined,
    expected_total: totals.server ? totals.total : undefined,
    payments,
    discount_approval_token: token ?? cart.approval_token,
    notes: cart.notes || undefined,
  }), [cart, totals]);

  const checkout = useMutation({
    mutationFn: (dto: CheckoutDto) => posApi.checkout(dto),
    onSuccess: (result) => {
      setPaymentOpen(false);
      setReceipt(result);
      carts.finishActive();
      void queryClient.invalidateQueries({ queryKey: ['pos', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['pos', 'shift'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(result.idempotent_replay ? `Giao dịch ${result.order_number} đã được ghi nhận trước đó` : `Đã bán ${result.order_number}`);
    },
    onError: (error, dto) => {
      const e = parsePosError(error);
      switch (e.code) {
        case 'PRICE_CHANGED':
          carts.applyPriceChanges(e.changes ?? []);
          toast.warning(`${e.message}. Giá trong giỏ đã được cập nhật, kiểm tra lại rồi thanh toán.`);
          setPaymentOpen(false);
          return;
        case 'TOTAL_CHANGED':
          void queryClient.invalidateQueries({ queryKey: ['pos', 'cart'] });
          toast.warning(`${e.message}. Kiểm tra lại giỏ hàng rồi thanh toán.`);
          setPaymentOpen(false);
          return;
        case 'VOUCHER_REJECTED':
          void queryClient.invalidateQueries({ queryKey: ['pos', 'cart'] });
          toast.error(e.message);
          setPaymentOpen(false);
          return;
        case 'INSUFFICIENT_STOCK':
          carts.markShortages(e.shortages ?? []);
          toast.error(e.message);
          setPaymentOpen(false);
          return;
        case 'DISCOUNT_APPROVAL_REQUIRED':
          setApproval({ requested: e.requestedPercent ?? 0, max: e.maxPercent ?? 0, payments: dto.payments });
          return;
        case 'SHIFT_NOT_OPEN':
          toast.error(e.message);
          void queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_KEY });
          return;
        case 'NETWORK':
          setOffline(true);
          toast.error(e.message);
          return;
        default:
          toast.error(e.message);
      }
    },
  });

  const submit = useCallback((payments: CheckoutPaymentDto[], token?: string) => {
    if (cart.lines.length === 0) return;
    checkout.mutate(buildDto(payments, token));
  }, [cart.lines.length, checkout, buildDto]);

  const shortcuts = useMemo(() => ({
    focusSearch: () => searchRef.current?.focus(),
    openCustomer: () => setCustomerOpen(true),
    openPayment: () => cart.lines.length > 0 && setPaymentOpen(true),
    completePayment: () => undefined, // handled inside PaymentSheet while it is open
    newTab: carts.newTab,
    switchTab: (i: number) => carts.carts[i] && carts.switchTab(carts.carts[i].id),
    showHelp: () => setHelpOpen(true),
    openReturn: () => setReturnOpen(true),
  }), [cart.lines.length, carts]);
  usePosShortcuts(shortcuts, !paymentOpen && !customerOpen && !approval && !returnOpen);

  // Server total (promotions, voucher, points) when available; checkout re-checks it with expected_total
  const amountDue = totals.total;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <CartTabs carts={carts.carts} activeId={cart.id} onSwitch={carts.switchTab} onNew={carts.newTab} onClose={carts.closeTab} />
        <div className="flex items-center gap-2">
          {offline && <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> Mất kết nối</Badge>}
          <Badge variant="outline">{shift.stores?.name} · {shift.session_number}</Badge>
          <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}><Undo2 className="h-4 w-4" /> Trả hàng (F7)</Button>
          <Button variant="outline" size="sm" onClick={() => setShiftOpen(true)}><Wallet className="h-4 w-4" /> Ca làm việc</Button>
          <Button variant="ghost" size="icon" aria-label="Phím tắt (F1)" onClick={() => setHelpOpen(true)}><Keyboard className="h-4 w-4" /></Button>
        </div>
      </div>

      {offline && (
        <Alert variant="destructive" className="rounded-none border-x-0">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>Không có kết nối máy chủ. Có thể tiếp tục soạn giỏ hàng; thanh toán cần kết nối.</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
        <section className="min-h-0 border-r p-4">
          <ProductSearch ref={searchRef} locationId={shift.location_id} onAdd={carts.addLine} />
        </section>
        <aside className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <CartLines lines={cart.lines} onQuantity={carts.setQuantity} onLineDiscount={carts.setLineDiscount} />
          </div>
          <div className="border-t bg-card p-4">
            <CartSummary
              cart={cart}
              totals={totals}
              pricing={carts.pricing}
              pricingError={carts.pricingError}
              onVoucher={carts.setVoucher}
              onOpenCustomer={() => setCustomerOpen(true)}
              onClearCustomer={() => carts.setCustomer(null)}
              onOrderDiscount={carts.setOrderDiscount}
              onPoints={carts.setPoints}
              onPay={() => setPaymentOpen(true)}
              storeId={shift.store_id}
              onPriceBook={carts.setPriceBook}
            />
          </div>
        </aside>
      </div>

      <CustomerLookupDialog open={customerOpen} onOpenChange={setCustomerOpen} onSelect={(c, n) => carts.setCustomer(c, n ?? null)} />
      <PaymentSheet open={paymentOpen} onOpenChange={setPaymentOpen} amountDue={amountDue} hasCustomer={!!(cart.customer || cart.new_customer)} isSubmitting={checkout.isPending} onComplete={(p) => submit(p)} creditBalance={credit?.balance ?? 0} />
      <ReturnSheet open={returnOpen} onOpenChange={setReturnOpen} onDone={setReturned} />
      <ReturnDoneDialog ret={returned} onOpenChange={(o) => !o && setReturned(null)} />
      {approval && (
        <ApprovalDialog
          open
          onOpenChange={(o) => !o && setApproval(null)}
          clientRequestId={cart.client_request_id}
          requestedPercent={approval.requested}
          maxPercent={approval.max}
          onApproved={(token) => { carts.setApprovalToken(token); const p = approval.payments; setApproval(null); submit(p, token); }}
        />
      )}
      <ShiftSheet open={shiftOpen} onOpenChange={setShiftOpen} shift={shift} onClosed={() => setShiftOpen(false)} />
      <ReceiptDialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)} receipt={receipt} onNewSale={() => searchRef.current?.focus()} />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
