import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Package,
  Filter,
  X,
} from 'lucide-react';
import {
  salesApi,
  type SalesOrderQueryParams,
  type SalesOrder,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SALES_CHANNEL_LABELS,
} from '@/lib/api/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table/DataTable';
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
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { getSalesOrderColumns } from '@/components/sales-orders/SalesOrderColumns';
import { SalesOrderFilterSheet, type FilterValues } from '@/components/sales-orders/SalesOrderFilterSheet';
import { PaymentDialog } from '@/components/sales-orders/PaymentDialog';

export function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'confirm' | 'cancel';
    order: SalesOrder;
  } | null>(null);

  // Extract filters from URL
  const filters: SalesOrderQueryParams = useMemo(() => ({
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    payment_status: searchParams.get('payment_status') || undefined,
    channel: searchParams.get('channel') || undefined,
    created_by: searchParams.get('created_by') || undefined,
    from_date: searchParams.get('from_date') || undefined,
    to_date: searchParams.get('to_date') || undefined,
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
  }), [searchParams]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.payment_status) count++;
    if (filters.channel) count++;
    if (filters.from_date) count++;
    if (filters.to_date) count++;
    return count;
  }, [filters]);

  // Fetch sales orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['sales-orders', filters],
    queryFn: () => salesApi.getAll(filters),
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: (id: string) => salesApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setConfirmAction(null);
      toast.success('Đã xác nhận đơn hàng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi xác nhận đơn hàng');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => salesApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setConfirmAction(null);
      toast.success('Đã hủy đơn hàng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng');
    },
  });

  // Calculate statistics
  const stats = ordersData?.data
    ? {
        totalOrders: ordersData.meta.total,
        totalRevenue: ordersData.data.reduce((sum, order) => sum + Number(order.total_amount), 0),
        pendingOrders: ordersData.data.filter((o) => o.status === 'draft' || o.status === 'pending').length,
        completedOrders: ordersData.data.filter((o) => o.status === 'completed').length,
      }
    : null;

  // Handle search
  const handleSearch = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('search', value);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Handle filter apply
  const handleApplyFilters = (newFilters: FilterValues) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    if (filters.search) newParams.set('search', filters.search);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Remove single filter
  const removeFilter = (key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Get columns with handlers
  const columns = getSalesOrderColumns({
    onConfirm: (order) => setConfirmAction({ type: 'confirm', order }),
    onCancel: (order) => setConfirmAction({ type: 'cancel', order }),
    onAddPayment: (order) => {
      setSelectedOrder(order);
      setIsPaymentOpen(true);
    },
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Đơn hàng bán lẻ</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý đơn hàng từ cửa hàng và các kênh bán hàng
            </p>
          </div>
          <Button onClick={() => navigate('/sales/orders/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo đơn hàng
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng đơn hàng</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Doanh thu</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chờ xử lý</CardTitle>
              <Package className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.pendingOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoàn thành</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completedOrders}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo mã đơn, tên khách hàng, số điện thoại..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Button variant="outline" onClick={() => setIsFilterOpen(true)}>
          <Filter className="mr-2 h-4 w-4" />
          Lọc
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Trạng thái: {ORDER_STATUS_LABELS[filters.status as keyof typeof ORDER_STATUS_LABELS]}
              <button onClick={() => removeFilter('status')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.payment_status && (
            <Badge variant="secondary" className="gap-1">
              Thanh toán: {PAYMENT_STATUS_LABELS[filters.payment_status as keyof typeof PAYMENT_STATUS_LABELS]}
              <button onClick={() => removeFilter('payment_status')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.channel && (
            <Badge variant="secondary" className="gap-1">
              Kênh: {SALES_CHANNEL_LABELS[filters.channel as keyof typeof SALES_CHANNEL_LABELS]}
              <button onClick={() => removeFilter('channel')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.from_date && (
            <Badge variant="secondary" className="gap-1">
              Từ: {filters.from_date}
              <button onClick={() => removeFilter('from_date')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.to_date && (
            <Badge variant="secondary" className="gap-1">
              Đến: {filters.to_date}
              <button onClick={() => removeFilter('to_date')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={ordersData?.data || []}
        isLoading={isLoading}
      />

      {/* Filter Sheet */}
      <SalesOrderFilterSheet
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        order={selectedOrder}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
          setSelectedOrder(null);
        }}
      />

      {/* Confirm/Cancel Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'confirm' ? 'Xác nhận đơn hàng' : 'Hủy đơn hàng'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'confirm'
                ? 'Bạn có chắc chắn muốn xác nhận đơn hàng này? Hành động này sẽ trừ tồn kho cho các sản phẩm trong đơn.'
                : 'Bạn có chắc chắn muốn hủy đơn hàng này? Hành động này sẽ hoàn lại tồn kho (nếu đã trừ).'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === 'confirm') {
                  confirmMutation.mutate(confirmAction.order.id);
                } else if (confirmAction?.type === 'cancel') {
                  cancelMutation.mutate(confirmAction.order.id);
                }
              }}
              className={confirmAction?.type === 'cancel' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmAction?.type === 'confirm' ? 'Xác nhận' : 'Hủy đơn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
