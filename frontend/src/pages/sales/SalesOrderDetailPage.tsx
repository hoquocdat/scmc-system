import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  CreditCard,
  Printer,
  Clock,
  Package,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  salesApi,
  type OrderStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SALES_CHANNEL_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/api/sales';
import { PaymentDialog } from '@/components/sales-orders/PaymentDialog';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<OrderStatus, { color: string }> = {
  draft: { color: 'bg-gray-500' },
  pending: { color: 'bg-yellow-500' },
  confirmed: { color: 'bg-blue-500' },
  processing: { color: 'bg-purple-500' },
  ready: { color: 'bg-green-500' },
  completed: { color: 'bg-green-600' },
  cancelled: { color: 'bg-red-500' },
};

export function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Fetch sales order
  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesApi.getById(id!),
    enabled: !!id,
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: () => salesApi.confirm(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setIsConfirmDialogOpen(false);
      toast.success('Đã xác nhận đơn hàng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi xác nhận đơn hàng');
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: OrderStatus) => salesApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Đã cập nhật trạng thái đơn hàng');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật trạng thái');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => salesApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setIsCancelDialogOpen(false);
      toast.success('Đã hủy đơn hàng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Không tìm thấy đơn hàng</p>
          <Button variant="link" onClick={() => navigate('/sales/orders')}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  const isDraft = order.status === 'draft';
  const isConfirmed = order.status === 'confirmed';
  const isProcessing = order.status === 'processing';
  const isReady = order.status === 'ready';
  const canAddPayment = ['confirmed', 'processing', 'ready'].includes(order.status) &&
    order.payment_status !== 'paid';
  const canCancel = ['draft', 'confirmed', 'processing'].includes(order.status);
  const remainingAmount = Number(order.total_amount) - Number(order.paid_amount || 0);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.order_number}</h1>
              <Badge className={`${STATUS_CONFIG[order.status].color} text-white`}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">Chi tiết đơn hàng</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button onClick={() => setIsConfirmDialogOpen(true)} disabled={confirmMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Xác nhận đơn
            </Button>
          )}
          {isConfirmed && (
            <Button onClick={() => updateStatusMutation.mutate('processing')} disabled={updateStatusMutation.isPending}>
              <Package className="mr-2 h-4 w-4" />
              Bắt đầu xử lý
            </Button>
          )}
          {isProcessing && (
            <Button onClick={() => updateStatusMutation.mutate('ready')} disabled={updateStatusMutation.isPending}>
              <Clock className="mr-2 h-4 w-4" />
              Sẵn sàng giao
            </Button>
          )}
          {isReady && order.payment_status === 'paid' && (
            <Button onClick={() => updateStatusMutation.mutate('completed')} disabled={updateStatusMutation.isPending}>
              <Truck className="mr-2 h-4 w-4" />
              Hoàn thành
            </Button>
          )}
          {canAddPayment && (
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Thanh toán
            </Button>
          )}
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            In hóa đơn
          </Button>
          {canCancel && (
            <Button variant="destructive" onClick={() => setIsCancelDialogOpen(true)} disabled={cancelMutation.isPending}>
              <XCircle className="mr-2 h-4 w-4" />
              Hủy đơn
            </Button>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Tên khách hàng</p>
              <p className="font-medium">{order.customer_name}</p>
            </div>
            {order.customer_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Số điện thoại</p>
                <p className="font-medium">{order.customer_phone}</p>
              </div>
            )}
            {order.customer_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.customer_email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Kênh bán hàng</span>
              <span className="font-medium">{SALES_CHANNEL_LABELS[order.channel]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Chi nhánh</span>
              <span className="font-medium">{order.stock_locations?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ngày tạo</span>
              <span className="font-medium">{formatDateTime(order.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Người tạo</span>
              <span className="font-medium">
                {order.user_profiles_sales_orders_created_byTouser_profiles?.full_name || '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Trạng thái</span>
              <Badge
                variant={
                  order.payment_status === 'paid'
                    ? 'default'
                    : order.payment_status === 'partial'
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {PAYMENT_STATUS_LABELS[order.payment_status]}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Đã thanh toán</span>
              <span className="font-medium text-green-600">
                {formatCurrency(order.paid_amount || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Còn lại</span>
              <span className={`font-medium ${remainingAmount > 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sản phẩm</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Giảm giá</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.sales_order_items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {item.products?.name || item.product_name || '-'}
                      </div>
                      {(item.product_variants?.name || item.variant_name) && (
                        <div className="text-sm text-muted-foreground">
                          {item.product_variants?.name || item.variant_name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.products?.sku || item.product_sku || '-'}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    {item.discount_amount ? `-${formatCurrency(item.discount_amount)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.total_amount)}
                  </TableCell>
                </TableRow>
              )) || (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Không có sản phẩm
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng kết tài chính</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tạm tính</span>
            <span className="font-medium">{formatCurrency(order.subtotal)}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Giảm giá
                {order.discount_type === 'percent' && order.discount_percent && (
                  <span className="ml-1">({order.discount_percent}%)</span>
                )}
              </span>
              <span className="font-medium text-red-500">
                -{formatCurrency(order.discount_amount)}
              </span>
            </div>
          )}
          {Number(order.tax_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thuế</span>
              <span className="font-medium">{formatCurrency(order.tax_amount)}</span>
            </div>
          )}
          {Number(order.shipping_cost) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí vận chuyển</span>
              <span className="font-medium">{formatCurrency(order.shipping_cost || 0)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Tổng cộng</span>
            <span className="text-xl font-bold">{formatCurrency(order.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đã thanh toán</span>
            <span className="font-medium text-green-600">
              {formatCurrency(order.paid_amount || 0)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Còn lại</span>
            <span className={`text-xl font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {order.sales_order_payments && order.sales_order_payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày thanh toán</TableHead>
                  <TableHead>Phương thức</TableHead>
                  <TableHead>Mã giao dịch</TableHead>
                  <TableHead>Người nhận</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.sales_order_payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDateTime(payment.created_at)}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                    </TableCell>
                    <TableCell>{payment.transaction_id || '-'}</TableCell>
                    <TableCell>{payment.user_profiles?.full_name || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xác nhận đơn hàng này? Hành động này sẽ trừ tồn kho cho các sản phẩm trong đơn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmMutation.mutate()}>
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy đơn hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy đơn hàng này? Hành động này sẽ hoàn lại tồn kho (nếu đã trừ).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Hủy đơn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        order={order}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
        }}
      />
    </div>
  );
}
