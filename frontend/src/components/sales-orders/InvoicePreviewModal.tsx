import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  type SalesOrder,
  SALES_CHANNEL_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/api/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrder;
}

export function InvoicePreviewModal({
  open,
  onOpenChange,
  order,
}: InvoicePreviewModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `Hoa-don-${order.order_number}`,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Xem trước hóa đơn</DialogTitle>
          <div className="flex gap-2">
            <Button onClick={() => handlePrint()} size="sm">
              <Printer className="mr-2 h-4 w-4" />
              In hóa đơn
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Invoice Content - This will be printed */}
        <div
          ref={invoiceRef}
          className="bg-white p-8 print:p-0"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Print Styles */}
          <style>
            {`
              @media print {
                @page {
                  size: A4;
                  margin: 15mm;
                }
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            `}
          </style>

          {/* Invoice Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {order.stores?.name || 'SAIGON CLASSIC'}
                </h1>
                {order.stores?.code && (
                  <p className="text-sm text-gray-600">Mã CH: {order.stores.code}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Điện thoại: 0123 456 789
                </p>
                <p className="text-sm text-gray-600">
                  Email: contact@saigonclassic.vn
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold text-gray-800">HÓA ĐƠN</h2>
                <p className="text-lg font-semibold mt-2">{order.order_number}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Ngày: {formatDateTime(order.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase">
                Thông tin khách hàng
              </h3>
              <div className="text-sm space-y-1">
                <p><span className="text-gray-600">Tên:</span> {order.customer_name}</p>
                {order.customer_phone && (
                  <p><span className="text-gray-600">SĐT:</span> {order.customer_phone}</p>
                )}
                {order.customer_email && (
                  <p><span className="text-gray-600">Email:</span> {order.customer_email}</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase">
                Thông tin đơn hàng
              </h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-600">Kênh bán:</span>{' '}
                  {SALES_CHANNEL_LABELS[order.channel]}
                </p>
                <p>
                  <span className="text-gray-600">Trạng thái:</span>{' '}
                  {PAYMENT_STATUS_LABELS[order.payment_status]}
                </p>
                {order.user_profiles_sales_orders_created_byTouser_profiles?.full_name && (
                  <p>
                    <span className="text-gray-600">Nhân viên:</span>{' '}
                    {order.user_profiles_sales_orders_created_byTouser_profiles.full_name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-6 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-3 font-semibold">STT</th>
                <th className="text-left py-2 px-3 font-semibold">Sản phẩm</th>
                <th className="text-left py-2 px-3 font-semibold">SKU</th>
                <th className="text-right py-2 px-3 font-semibold">SL</th>
                <th className="text-right py-2 px-3 font-semibold">Đơn giá</th>
                <th className="text-right py-2 px-3 font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.sales_order_items?.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2 px-3">{index + 1}</td>
                  <td className="py-2 px-3">
                    <div>{item.products?.name || item.product_name || '-'}</div>
                    {(item.product_variants?.name || item.variant_name) && (
                      <div className="text-xs text-gray-500">
                        {item.product_variants?.name || item.variant_name}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-600">
                    {item.products?.sku || item.product_sku || '-'}
                  </td>
                  <td className="py-2 px-3 text-right">{item.quantity}</td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-2 px-3 text-right font-medium">
                    {formatCurrency(item.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Summary */}
          <div className="flex justify-end mb-6">
            <div className="w-72">
              <div className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">Tạm tính:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">
                    Giảm giá
                    {order.discount_type === 'percent' && order.discount_percent && (
                      <span> ({order.discount_percent}%)</span>
                    )}
                    :
                  </span>
                  <span className="text-red-600">-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              {Number(order.tax_amount) > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">Thuế:</span>
                  <span>{formatCurrency(order.tax_amount)}</span>
                </div>
              )}
              {Number(order.shipping_cost) > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">Phí vận chuyển:</span>
                  <span>{formatCurrency(order.shipping_cost || 0)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-gray-800 mt-2">
                <span className="font-bold text-lg">TỔNG CỘNG:</span>
                <span className="font-bold text-lg">{formatCurrency(order.total_amount)}</span>
              </div>
              {Number(order.paid_amount) > 0 && (
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">Đã thanh toán:</span>
                  <span className="text-green-600">{formatCurrency(order.paid_amount || 0)}</span>
                </div>
              )}
              {Number(order.total_amount) - Number(order.paid_amount || 0) > 0 && (
                <div className="flex justify-between py-1 text-sm font-semibold">
                  <span>Còn lại:</span>
                  <span className="text-red-600">
                    {formatCurrency(Number(order.total_amount) - Number(order.paid_amount || 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          {order.sales_order_payments && order.sales_order_payments.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase">
                Lịch sử thanh toán
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-1 px-2">Ngày</th>
                    <th className="text-left py-1 px-2">Phương thức</th>
                    <th className="text-left py-1 px-2">Mã GD</th>
                    <th className="text-right py-1 px-2">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.sales_order_payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-100">
                      <td className="py-1 px-2">{formatDateTime(payment.created_at)}</td>
                      <td className="py-1 px-2">
                        {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                      </td>
                      <td className="py-1 px-2">{payment.transaction_id || '-'}</td>
                      <td className="py-1 px-2 text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase">
                Ghi chú
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-300 pt-4 mt-8">
            <div className="grid grid-cols-2 gap-8 text-center">
              <div>
                <p className="text-sm text-gray-600 mb-12">Khách hàng</p>
                <p className="text-sm font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-12">Nhân viên bán hàng</p>
                <p className="text-sm font-medium">
                  {order.user_profiles_sales_orders_created_byTouser_profiles?.full_name || '-'}
                </p>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-8">
              Cảm ơn quý khách đã mua hàng tại {order.stores?.name || 'Saigon Classic'}!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
