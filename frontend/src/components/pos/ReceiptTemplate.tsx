import { forwardRef } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/lib/api/products';
import type { Customer } from '@/lib/api/customers';

export interface ReceiptItem {
  product: Product;
  quantity: number;
  price: number;
  discount?: number;
}

export interface ReceiptData {
  receiptNumber: string;
  date: Date;
  customer?: Customer | null;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change?: number;
  cashier?: string;
  location?: string;
}

interface ReceiptTemplateProps {
  data: ReceiptData;
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ data }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white p-8 max-w-sm mx-auto font-mono text-sm"
        style={{ width: '80mm' }} // Standard thermal printer width
      >
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-dashed border-gray-400 pb-4">
          <h1 className="text-2xl font-bold mb-1">SAIGON CLASSIC</h1>
          <p className="text-xs">Motorcycle Parts & Service</p>
          <p className="text-xs mt-1">
            {data.location || 'HCMC Store'}
          </p>
          <p className="text-xs">123 Nguyen Hue, District 1</p>
          <p className="text-xs">Ho Chi Minh City, Vietnam</p>
          <p className="text-xs">Tel: +84 28 1234 5678</p>
        </div>

        {/* Receipt Info */}
        <div className="mb-4 text-xs">
          <div className="flex justify-between mb-1">
            <span>Receipt #:</span>
            <span className="font-bold">{data.receiptNumber}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Date:</span>
            <span>{data.date.toLocaleString('vi-VN')}</span>
          </div>
          {data.cashier && (
            <div className="flex justify-between mb-1">
              <span>Cashier:</span>
              <span>{data.cashier}</span>
            </div>
          )}
          {data.customer && (
            <div className="flex justify-between mb-1">
              <span>Customer:</span>
              <span>{data.customer.full_name}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-t-2 border-b-2 border-dashed border-gray-400 py-3 mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left pb-2">Item</th>
                <th className="text-center pb-2">Qty</th>
                <th className="text-right pb-2">Price</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-2">
                    <div className="font-semibold">{item.product.name}</div>
                    <div className="text-gray-600">{item.product.sku}</div>
                  </td>
                  <td className="text-center py-2">{item.quantity}</td>
                  <td className="text-right py-2">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="text-right py-2 font-semibold">
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-4 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount:</span>
              <span>-{formatCurrency(data.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>VAT (10%):</span>
            <span>{formatCurrency(data.vat)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t-2 border-gray-400 pt-2 mt-2">
            <span>TOTAL:</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="border-t-2 border-dashed border-gray-400 pt-3 mb-4 text-xs">
          <div className="flex justify-between mb-1">
            <span>Payment Method:</span>
            <span className="font-semibold uppercase">{data.paymentMethod}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Amount Paid:</span>
            <span className="font-semibold">{formatCurrency(data.amountPaid)}</span>
          </div>
          {data.change !== undefined && data.change > 0 && (
            <div className="flex justify-between text-lg font-bold">
              <span>Change:</span>
              <span>{formatCurrency(data.change)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs border-t-2 border-dashed border-gray-400 pt-4 space-y-2">
          <p className="font-semibold">Thank you for your purchase!</p>
          <p>Please keep this receipt for warranty claims</p>
          <p className="mt-2">Exchange/Return within 7 days with receipt</p>

          {/* Barcode placeholder */}
          <div className="mt-4 flex justify-center">
            <svg
              width="200"
              height="60"
              className="border border-gray-300"
            >
              {/* Simple barcode representation */}
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill="#333"
              >
                {data.receiptNumber}
              </text>
            </svg>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Generated with Claude Code
          </p>
          <p className="text-xs text-gray-500">
            www.saigonclassic.com
          </p>
        </div>
      </div>
    );
  }
);

ReceiptTemplate.displayName = 'ReceiptTemplate';
