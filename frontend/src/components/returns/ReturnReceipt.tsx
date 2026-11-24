import { forwardRef } from 'react';
import { money, REASON_LABELS, REFUND_METHOD_LABELS, type SalesReturn } from '@/lib/api/sales-returns';
import { formatCurrency, formatDateTime } from '@/lib/utils';

/** Printable return slip (80 mm). */
export const ReturnReceipt = forwardRef<HTMLDivElement, { ret: SalesReturn }>(function ReturnReceipt({ ret }, ref) {
  const order = ret.sales_orders_sales_returns_sales_order_idTosales_orders;
  const exchange = ret.sales_orders_sales_returns_exchange_order_idTosales_orders;
  return (
    <div ref={ref} className="mx-auto w-[300px] space-y-2 bg-white p-3 font-mono text-[12px] text-black">
      <div className="text-center">
        <div className="font-bold">{ret.stores?.name ?? 'SCMC'}</div>
        {ret.stores?.address && <div>{ret.stores.address}</div>}
        <div className="mt-1 font-bold">{ret.kind === 'exchange' ? 'PHIẾU ĐỔI HÀNG' : 'PHIẾU TRẢ HÀNG'}</div>
        <div>{ret.return_number} · {formatDateTime(ret.created_at)}</div>
        <div>Đơn gốc: {order.order_number}</div>
        {ret.customers && <div>KH: {ret.customers.full_name} {ret.customers.phone ?? ''}</div>}
      </div>
      <hr className="border-dashed border-black" />
      {ret.sales_return_items.map((i) => (
        <div key={i.id}>
          <div>{i.product_name}</div>
          <div className="flex justify-between">
            <span>{i.quantity} × {formatCurrency(money(i.unit_refund))}{i.restock ? '' : ' (hỏng)'}</span>
            <span>{formatCurrency(money(i.line_refund))}</span>
          </div>
          <div className="text-[11px]">Lý do: {REASON_LABELS[i.reason_code]}</div>
        </div>
      ))}
      <hr className="border-dashed border-black" />
      <div className="flex justify-between font-bold"><span>Giá trị hàng trả</span><span>{formatCurrency(money(ret.goods_amount))}</span></div>
      {money(ret.receivable_reduction) > 0 && <div className="flex justify-between"><span>Trừ công nợ</span><span>{formatCurrency(money(ret.receivable_reduction))}</span></div>}
      {ret.sales_return_refunds.map((r) => (
        <div key={r.id} className="flex justify-between"><span>{REFUND_METHOD_LABELS[r.method]}</span><span>{formatCurrency(money(r.amount))}</span></div>
      ))}
      {exchange && <div>Đơn đổi: {exchange.order_number} ({formatCurrency(money(exchange.total_amount))})</div>}
      {(ret.points_reversed > 0 || ret.points_restored > 0) && <div>Điểm: −{ret.points_reversed} / +{ret.points_restored}</div>}
      <hr className="border-dashed border-black" />
      <div className="text-center">Nhân viên: {ret.user_profiles_sales_returns_created_byTouser_profiles?.full_name ?? ''}</div>
    </div>
  );
});
