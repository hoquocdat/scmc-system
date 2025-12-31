import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, DollarSign, FileText, TrendingDown, TrendingUp, Plus, Edit } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { suppliersApi } from '@/lib/api/suppliers';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { RecordSupplierPaymentDialog } from '@/components/supplier-payments/RecordSupplierPaymentDialog';
import { CreateSupplierReturnDialog } from '@/components/supplier-returns/CreateSupplierReturnDialog';
import { SupplierEditSheet } from '@/components/suppliers/SupplierEditSheet';
import { useUrlTabs } from '@/hooks/useUrlTabs';

export function SupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTab, setActiveTab } = useUrlTabs('outstanding');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  // Fetch supplier details
  const { data: supplierDetails, isLoading } = useQuery({
    queryKey: ['supplierDetails', id],
    queryFn: () => suppliersApi.getDetails(id!),
    enabled: !!id,
  });

  // Fetch transaction history
  const { data: transactions } = useQuery({
    queryKey: ['supplierTransactions', id],
    queryFn: () => suppliersApi.getTransactionHistory(id!),
    enabled: !!id,
  });

  // Fetch purchase history
  const { data: purchaseHistory } = useQuery({
    queryKey: ['supplierPurchaseHistory', id],
    queryFn: () => suppliersApi.getPurchaseHistory(id!),
    enabled: !!id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center">Đang tải thông tin nhà cung cấp...</div>
      </div>
    );
  }

  if (!supplierDetails) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center">
          <p className="text-lg mb-4">Không tìm thấy nhà cung cấp</p>
          <Button onClick={() => navigate('/suppliers')}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  const accountsPayable = supplierDetails.accounts_payable;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/suppliers')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {supplierDetails.name}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {supplierDetails.contact_person && `Liên hệ: ${supplierDetails.contact_person}`}
              {supplierDetails.phone && ` • ${supplierDetails.phone}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditSheetOpen(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </Button>
            <Button variant="outline" onClick={() => setIsReturnDialogOpen(true)}>
              <TrendingDown className="mr-2 h-4 w-4" />
              Trả hàng
            </Button>
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ghi nhận thanh toán
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex gap-2">
          {supplierDetails.is_active ? (
            <Badge variant="default">Đang hoạt động</Badge>
          ) : (
            <Badge variant="secondary">Ngừng hoạt động</Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
      {/* Supplier Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin liên hệ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Người liên hệ</p>
            <p className="font-medium">{supplierDetails.contact_person || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Số điện thoại</p>
            <p className="font-medium">{supplierDetails.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{supplierDetails.email || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Địa chỉ</p>
            <p className="font-medium">{supplierDetails.address || '-'}</p>
          </div>
          {supplierDetails.notes && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Ghi chú</p>
              <p className="font-medium">{supplierDetails.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts Payable Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng mua hàng</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(accountsPayable?.total_purchases || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng trả hàng</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(accountsPayable?.total_returns || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã thanh toán</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(accountsPayable?.total_payments || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Công nợ</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(accountsPayable?.balance_due || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="outstanding">Đơn hàng chưa thanh toán</TabsTrigger>
          <TabsTrigger value="transactions">Lịch sử giao dịch</TabsTrigger>
          <TabsTrigger value="purchases">Lịch sử mua hàng</TabsTrigger>
        </TabsList>

        {/* Outstanding Purchase Orders */}
        <TabsContent value="outstanding">
          <Card>
            <CardHeader>
              <CardTitle>Đơn hàng chưa thanh toán</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đơn</TableHead>
                    <TableHead>Ngày đặt</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead className="text-right">Đã trả</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierDetails.outstanding_purchase_orders &&
                  supplierDetails.outstanding_purchase_orders.length > 0 ? (
                    supplierDetails.outstanding_purchase_orders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.order_number}</TableCell>
                        <TableCell>
                          {format(new Date(po.order_date), 'dd/MM/yyyy', { locale: vi })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(po.total_amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(po.paid_amount))}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(Number(po.balance_due))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{po.payment_status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}
                          >
                            Chi tiết
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Không có đơn hàng chưa thanh toán
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử giao dịch</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Mã tham chiếu</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions && transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {transaction.transaction_type === 'purchase' && (
                            <Badge className="bg-blue-500 text-white">Mua hàng</Badge>
                          )}
                          {transaction.transaction_type === 'return' && (
                            <Badge className="bg-orange-500 text-white">Trả hàng</Badge>
                          )}
                          {transaction.transaction_type === 'payment' && (
                            <Badge className="bg-green-500 text-white">Thanh toán</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {transaction.reference_number}
                        </TableCell>
                        <TableCell>
                          {format(new Date(transaction.transaction_date), 'dd/MM/yyyy HH:mm', {
                            locale: vi,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(transaction.amount))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {transaction.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Chưa có giao dịch nào
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase History */}
        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử mua hàng</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đơn</TableHead>
                    <TableHead>Ngày đặt</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead className="text-right">Đã trả</TableHead>
                    <TableHead>TT thanh toán</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseHistory && purchaseHistory.length > 0 ? (
                    purchaseHistory.map((po: any) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.order_number}</TableCell>
                        <TableCell>
                          {format(new Date(po.order_date), 'dd/MM/yyyy', { locale: vi })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(po.total_amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(po.paid_amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{po.payment_status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}
                          >
                            Chi tiết
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Chưa có lịch sử mua hàng
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Dialogs */}
      <SupplierEditSheet
        supplier={supplierDetails}
        isOpen={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['supplierDetails', id] });
        }}
      />

      <RecordSupplierPaymentDialog
        supplierId={id!}
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['supplierDetails', id] });
          queryClient.invalidateQueries({ queryKey: ['supplierTransactions', id] });
          queryClient.invalidateQueries({ queryKey: ['supplierPurchaseHistory', id] });
        }}
      />

      <CreateSupplierReturnDialog
        supplierId={id!}
        open={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['supplierDetails', id] });
          queryClient.invalidateQueries({ queryKey: ['supplierTransactions', id] });
          queryClient.invalidateQueries({ queryKey: ['supplierPurchaseHistory', id] });
        }}
      />
    </div>
  );
}
