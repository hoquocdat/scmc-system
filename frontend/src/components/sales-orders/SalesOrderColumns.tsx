import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, CheckCircle, XCircle, CreditCard, Printer } from 'lucide-react';
import {
  type SalesOrder,
  type OrderStatus,
  type PaymentStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SALES_CHANNEL_LABELS,
} from '@/lib/api/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface ColumnsProps {
  onConfirm?: (order: SalesOrder) => void;
  onCancel?: (order: SalesOrder) => void;
  onAddPayment?: (order: SalesOrder) => void;
}

const getStatusBadgeVariant = (status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variants: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    pending: 'secondary',
    confirmed: 'default',
    processing: 'default',
    ready: 'default',
    completed: 'default',
    cancelled: 'destructive',
  };
  return variants[status] || 'secondary';
};

const getPaymentStatusBadgeVariant = (status: PaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variants: Record<PaymentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    unpaid: 'destructive',
    partial: 'secondary',
    paid: 'default',
    refunded: 'outline',
  };
  return variants[status] || 'secondary';
};

export function getSalesOrderColumns({ onConfirm, onCancel, onAddPayment }: ColumnsProps = {}): ColumnDef<SalesOrder>[] {
  return [
    {
      accessorKey: 'order_number',
      header: 'Mã đơn',
      cell: ({ row }) => (
        <Link
          to={`/sales/orders/${row.original.id}`}
          className="font-mono font-medium text-primary hover:underline"
        >
          {row.original.order_number}
        </Link>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: 'Khách hàng',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customer_name}</div>
          {row.original.customer_phone && (
            <div className="text-sm text-muted-foreground">{row.original.customer_phone}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'channel',
      header: 'Kênh bán',
      cell: ({ row }) => (
        <div className="text-sm">
          {SALES_CHANNEL_LABELS[row.original.channel] || row.original.channel}
        </div>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Tổng tiền',
      cell: ({ row }) => (
        <div className="font-medium">{formatCurrency(row.original.total_amount)}</div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <Badge variant={getStatusBadgeVariant(row.original.status)}>
          {ORDER_STATUS_LABELS[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'payment_status',
      header: 'Thanh toán',
      cell: ({ row }) => (
        <Badge variant={getPaymentStatusBadgeVariant(row.original.payment_status)}>
          {PAYMENT_STATUS_LABELS[row.original.payment_status] || row.original.payment_status}
        </Badge>
      ),
    },
    {
      accessorKey: 'user_profiles_sales_orders_created_byTouser_profiles',
      header: 'Nhân viên',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.user_profiles_sales_orders_created_byTouser_profiles?.full_name || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Ngày tạo',
      cell: ({ row }) => (
        <div className="text-sm">{formatDateTime(row.original.created_at)}</div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const order = row.original;
        const isDraft = order.status === 'draft';
        const canAddPayment = ['confirmed', 'processing', 'ready'].includes(order.status) &&
          order.payment_status !== 'paid';
        const canCancel = ['draft', 'confirmed', 'processing'].includes(order.status);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Mở menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`/sales/orders/${order.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Xem chi tiết
                </Link>
              </DropdownMenuItem>
              {isDraft && onConfirm && (
                <DropdownMenuItem onClick={() => onConfirm(order)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Xác nhận đơn
                </DropdownMenuItem>
              )}
              {canAddPayment && onAddPayment && (
                <DropdownMenuItem onClick={() => onAddPayment(order)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Thanh toán
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Printer className="mr-2 h-4 w-4" />
                In hóa đơn
              </DropdownMenuItem>
              {canCancel && onCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onCancel(order)}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Hủy đơn
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
