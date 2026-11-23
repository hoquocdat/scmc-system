import { forwardRef } from 'react';
import { num, POS_PAYMENT_METHOD_LABELS, type PosPaymentMethod, type PosReceipt } from '@/lib/api/pos';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export type ReceiptPaper = '80mm' | 'A4';

interface ReceiptTemplateProps {
  receipt: PosReceipt;
  paper?: ReceiptPaper;
}

/** Receipt rendered from server data only (order, store, cashier, payments, loyalty). */
export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(function ReceiptTemplate({ receipt, paper = '80mm' }, ref) {
  const store = receipt.stores;
  const cashier = receipt.user_profiles_sales_orders_created_byTouser_profiles?.full_name ?? '—';
  const paid = receipt.sales_order_payments.filter((p) => p.status === 'completed').reduce((s, p) => s + num(p.amount), 0);
  const balance = Math.max(0, num(receipt.total_amount) - paid);
  const lineDiscounts = receipt.sales_order_items.reduce((s, l) => s + num(l.discount_amount) * l.quantity, 0);
  const gross = receipt.sales_order_items.reduce((s, l) => s + num(l.unit_price) * l.quantity, 0);
  const narrow = paper === '80mm';

  return (
    <div ref={ref} className={`mx-auto bg-white text-black ${narrow ? 'font-mono text-xs' : 'text-sm'}`} style={{ width: narrow ? '80mm' : '190mm', padding: narrow ? '4mm' : '12mm' }}>
      {receipt.reprint && <div className="mb-2 border border-black text-center font-bold uppercase">Bản in lại</div>}
      <div className={`text-center ${narrow ? 'mb-2' : 'mb-4'}`}>
        <div className={`font-bold ${narrow ? 'text-base' : 'text-2xl'}`}>{store?.name ?? 'SCMC'}</div>
        {store?.address && <div>{store.address}{store.city ? `, ${store.city}` : ''}</div>}
        {store?.phone && <div>ĐT: {store.phone}</div>}
      </div>
      <div className="border-t border-dashed border-black" />
      <div className="my-1 grid grid-cols-[auto_1fr] gap-x-2">
        <span>Số HĐ:</span><span className="text-right font-bold">{receipt.order_number}</span>
        <span>Ngày:</span><span className="text-right">{formatDateTime(receipt.order_date ?? receipt.created_at ?? new Date().toISOString())}</span>
        <span>Thu ngân:</span><span className="text-right">{cashier}</span>
        <span>Khách:</span><span className="text-right">{receipt.customers?.full_name ?? receipt.customer_name}{receipt.customer_phone ? ` · ${receipt.customer_phone}` : ''}</span>
      </div>
      <div className="border-t border-dashed border-black" />

      <table className="my-1 w-full">
        <thead>
          <tr className="text-left">
            <th className="font-normal">Sản phẩm</th>
            <th className="text-right font-normal">SL</th>
            <th className="text-right font-normal">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {receipt.sales_order_items.map((l) => (
            <tr key={l.id} className="align-top">
              <td>
                {l.product_name}
                <div className="opacity-70">{formatCurrency(num(l.unit_price))}{num(l.discount_amount) > 0 && <> (-{formatCurrency(num(l.discount_amount))})</>}</div>
              </td>
              <td className="text-right">{l.quantity}</td>
              <td className="text-right tabular-nums">{formatCurrency((num(l.unit_price) - num(l.discount_amount)) * l.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black" />

      <div className="my-1 space-y-0.5">
        <Row label="Tạm tính" value={formatCurrency(gross)} />
        {lineDiscounts > 0 && <Row label="Giảm theo dòng" value={`-${formatCurrency(lineDiscounts)}`} />}
        {num(receipt.discount_amount) > 0 && <Row label={`Giảm giá đơn${num(receipt.discount_percent) > 0 ? ` (${num(receipt.discount_percent)}%)` : ''}`} value={`-${formatCurrency(num(receipt.discount_amount))}`} />}
        {num(receipt.loyalty_discount_amount) > 0 && <Row label={`Điểm thưởng (${receipt.loyalty_points_redeemed ?? 0} điểm)`} value={`-${formatCurrency(num(receipt.loyalty_discount_amount))}`} />}
        {num(receipt.tax_amount) > 0 && <Row label="Thuế" value={formatCurrency(num(receipt.tax_amount))} />}
        <Row label="TỔNG CỘNG" value={formatCurrency(num(receipt.total_amount))} strong />
      </div>
      <div className="border-t border-dashed border-black" />
      <div className="my-1 space-y-0.5">
        {receipt.sales_order_payments.map((p) => (
          <div key={p.id}>
            <Row label={POS_PAYMENT_METHOD_LABELS[p.payment_method as PosPaymentMethod] ?? p.payment_method} value={formatCurrency(num(p.amount))} />
            {p.payment_method === 'cash' && num(p.amount_tendered) > 0 && (
              <>
                <Row label="  Khách đưa" value={formatCurrency(num(p.amount_tendered))} />
                <Row label="  Tiền thối" value={formatCurrency(num(p.change_given))} />
              </>
            )}
          </div>
        ))}
        {balance > 0 && <Row label="Còn nợ" value={formatCurrency(balance)} strong />}
      </div>
      {receipt.loyalty && (
        <>
          <div className="border-t border-dashed border-black" />
          <div className="my-1">
            {(receipt.loyalty_points_earned ?? 0) > 0 && <Row label="Điểm tích lũy" value={`+${receipt.loyalty_points_earned}`} />}
            <Row label="Điểm hiện có" value={`${receipt.loyalty.points_balance.toLocaleString('vi-VN')}${receipt.loyalty.tier ? ` · ${receipt.loyalty.tier}` : ''}`} />
          </div>
        </>
      )}
      <div className="border-t border-dashed border-black" />
      <div className="mt-2 text-center">
        <div>Cảm ơn quý khách!</div>
        <div className="opacity-70">Vui lòng giữ hóa đơn để đổi trả.</div>
      </div>
    </div>
  );
});

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between whitespace-pre ${strong ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
