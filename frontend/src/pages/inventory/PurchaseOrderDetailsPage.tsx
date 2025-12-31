import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
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
import { purchaseOrdersApi, type PurchaseOrderStatus } from '@/lib/api/purchase-orders';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  PurchaseOrderStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Nháp', color: 'bg-gray-500' },
  pending_approval: { label: 'Chờ duyệt', color: 'bg-yellow-500' },
  approved: { label: 'Đã duyệt', color: 'bg-green-500' },
  rejected: { label: 'Bị từ chối', color: 'bg-red-500' },
  cancelled: { label: 'Đã hủy', color: 'bg-gray-500' },
};

export function PurchaseOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Fetch purchase order
  const { data: purchaseOrder, isLoading } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => purchaseOrdersApi.getOne(id!),
    enabled: !!id,
  });

  // Submit for approval mutation
  const submitMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.submitForApproval(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success('Đã gửi đơn đặt hàng để duyệt');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi gửi duyệt');
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.approve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success('Đã duyệt đơn đặt hàng. Tồn kho đã được cập nhật.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi duyệt đơn hàng');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.reject(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setIsRejectDialogOpen(false);
      toast.success('Đã từ chối đơn đặt hàng');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi từ chối đơn hàng');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setIsCancelDialogOpen(false);
      toast.success('Đã hủy đơn đặt hàng');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success('Đã xóa đơn đặt hàng');
      navigate('/inventory/purchase-orders');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi xóa đơn hàng');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Không tìm thấy đơn đặt hàng</p>
          <Button variant="link" onClick={() => navigate('/inventory/purchase-orders')}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  const isDraft = purchaseOrder.status === 'draft';
  const isPendingApproval = purchaseOrder.status === 'pending_approval';
  const isApproved = purchaseOrder.status === 'approved';
  const balanceDue = Number(purchaseOrder.total_amount) - Number(purchaseOrder.paid_amount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/purchase-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{purchaseOrder.order_number}</h1>
            <p className="text-muted-foreground">
              Chi tiết đơn đặt hàng
            </p>
          </div>
          <Badge className={`${STATUS_CONFIG[purchaseOrder.status].color} text-white`}>
            {STATUS_CONFIG[purchaseOrder.status].label}
          </Badge>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(`/inventory/purchase-orders/${id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </Button>
              <Button
                variant="outline"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Gửi duyệt
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(true)}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Hủy đơn
              </Button>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa
              </Button>
            </>
          )}
          {isPendingApproval && (
            <>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Duyệt đơn
              </Button>
              <Button
                variant="destructive"
                onClick={() => setIsRejectDialogOpen(true)}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Từ chối
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin nhà cung cấp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Nhà cung cấp</p>
              <p className="font-medium">{purchaseOrder.suppliers?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liên hệ</p>
              <p>{purchaseOrder.suppliers?.contact_person || '-'}</p>
              <p className="text-sm">{purchaseOrder.suppliers?.phone || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ngày đặt hàng</span>
              <span className="font-medium">
                {format(new Date(purchaseOrder.order_date), 'dd/MM/yyyy', { locale: vi })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ngày giao dự kiến</span>
              <span className="font-medium">
                {purchaseOrder.expected_delivery_date
                  ? format(new Date(purchaseOrder.expected_delivery_date), 'dd/MM/yyyy', {
                      locale: vi,
                    })
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Người tạo</span>
              <span className="font-medium">
                {purchaseOrder.user_profiles?.full_name || '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sản phẩm</CardTitle>
          {isDraft && (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Thêm sản phẩm
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">SL đặt</TableHead>
                <TableHead className="text-right">SL nhận</TableHead>
                <TableHead className="text-right">SL trả</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
                {isDraft && <TableHead className="text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.purchase_order_items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.products?.name || item.product_variants?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {item.products?.sku || item.product_variants?.sku || '-'}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                  <TableCell className="text-right">{item.quantity_received}</TableCell>
                  <TableCell className="text-right">{item.quantity_returned}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(item.unit_cost))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(item.total_cost))}
                  </TableCell>
                  {isDraft && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Sửa
                      </Button>
                      <Button variant="ghost" size="sm">
                        Xóa
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )) || (
                <TableRow>
                  <TableCell colSpan={isDraft ? 8 : 7} className="text-center">
                    Chưa có sản phẩm nào
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
            <span className="text-muted-foreground">Tổng giá trị hàng hóa</span>
            <span className="font-medium">
              {formatCurrency(Number(purchaseOrder.subtotal))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Thuế</span>
            <span className="font-medium">
              {formatCurrency(Number(purchaseOrder.tax_amount))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phí vận chuyển</span>
            <span className="font-medium">
              {formatCurrency(Number(purchaseOrder.shipping_cost))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Giảm giá</span>
            <span className="font-medium text-red-500">
              -{formatCurrency(Number(purchaseOrder.discount_amount))}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Tổng cộng</span>
            <span className="text-xl font-bold">
              {formatCurrency(Number(purchaseOrder.total_amount))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đã thanh toán</span>
            <span className="font-medium text-green-600">
              {formatCurrency(Number(purchaseOrder.paid_amount))}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Còn lại</span>
            <span className="text-xl font-bold text-red-600">
              {formatCurrency(balanceDue)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Allocations */}
      {isApproved && purchaseOrder.supplier_payment_allocations &&
       purchaseOrder.supplier_payment_allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã thanh toán</TableHead>
                  <TableHead>Ngày thanh toán</TableHead>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.supplier_payment_allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>
                      {allocation.supplier_payments?.payment_number || '-'}
                    </TableCell>
                    <TableCell>
                      {allocation.supplier_payments?.payment_date
                        ? format(
                            new Date(allocation.supplier_payments.payment_date),
                            'dd/MM/yyyy',
                            { locale: vi }
                          )
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {allocation.supplier_payments?.payment_method || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(allocation.amount_allocated))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {purchaseOrder.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{purchaseOrder.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa đơn đặt hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đơn đặt hàng này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận hủy đơn đặt hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy đơn đặt hàng này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMutation.mutate()}>
              Có, hủy đơn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận từ chối đơn đặt hàng</AlertDialogTitle>
            <AlertDialogDescription>
              Vui lòng nhập lý do từ chối đơn đặt hàng này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const reason = prompt('Lý do từ chối:');
                if (reason) {
                  rejectMutation.mutate(reason);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Từ chối
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
