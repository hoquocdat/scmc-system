import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Filter, X, FileText, Package, DollarSign } from 'lucide-react';
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { purchaseOrdersApi, type PurchaseOrderStatus, type PurchaseOrderPaymentStatus } from '@/lib/api/purchase-orders';
import { suppliersApi } from '@/lib/api/suppliers';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const STATUS_OPTIONS: { value: PurchaseOrderStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Nháp', color: 'bg-gray-500' },
  { value: 'pending_approval', label: 'Chờ duyệt', color: 'bg-yellow-500' },
  { value: 'approved', label: 'Đã duyệt', color: 'bg-green-500' },
  { value: 'rejected', label: 'Bị từ chối', color: 'bg-red-500' },
  { value: 'cancelled', label: 'Đã hủy', color: 'bg-gray-500' },
];

const PAYMENT_STATUS_OPTIONS: { value: PurchaseOrderPaymentStatus; label: string; color: string }[] = [
  { value: 'unpaid', label: 'Chưa thanh toán', color: 'bg-red-500' },
  { value: 'partially_paid', label: 'Thanh toán một phần', color: 'bg-yellow-500' },
  { value: 'paid', label: 'Đã thanh toán', color: 'bg-green-500' },
];

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Get filters from URL
  const filters = useMemo(
    () => ({
      search: searchParams.get('search') || undefined,
      supplier_id: searchParams.get('supplier_id') || undefined,
      status: searchParams.get('status') as PurchaseOrderStatus | undefined,
      payment_status: searchParams.get('payment_status') as PurchaseOrderPaymentStatus | undefined,
      order_date_from: searchParams.get('order_date_from') || undefined,
      order_date_to: searchParams.get('order_date_to') || undefined,
    }),
    [searchParams],
  );

  // Local filter state
  const [localFilters, setLocalFilters] = useState(filters);

  // Fetch purchase orders
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchaseOrders', filters],
    queryFn: () => purchaseOrdersApi.getAll(filters),
  });

  // Fetch suppliers for filter dropdown
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getAll,
  });

  // Apply filters
  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (localFilters.search) params.set('search', localFilters.search);
    if (localFilters.supplier_id) params.set('supplier_id', localFilters.supplier_id);
    if (localFilters.status) params.set('status', localFilters.status);
    if (localFilters.payment_status) params.set('payment_status', localFilters.payment_status);
    if (localFilters.order_date_from) params.set('order_date_from', localFilters.order_date_from);
    if (localFilters.order_date_to) params.set('order_date_to', localFilters.order_date_to);
    setSearchParams(params);
    setIsFilterOpen(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    setLocalFilters({
      search: undefined,
      supplier_id: undefined,
      status: undefined,
      payment_status: undefined,
      order_date_from: undefined,
      order_date_to: undefined,
    });
    setSearchParams(new URLSearchParams());
    setIsFilterOpen(false);
  };

  // Clear individual filter
  const clearFilter = (key: keyof typeof filters) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    setSearchParams(newParams);
  };

  // Count active filters
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  // Get status badge
  const getStatusBadge = (status: PurchaseOrderStatus) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === status);
    if (!option) return null;
    return (
      <Badge className={`${option.color} text-white`}>
        {option.label}
      </Badge>
    );
  };

  // Get payment status badge
  const getPaymentStatusBadge = (status: PurchaseOrderPaymentStatus) => {
    const option = PAYMENT_STATUS_OPTIONS.find((opt) => opt.value === status);
    if (!option) return null;
    return (
      <Badge className={`${option.color} text-white`}>
        {option.label}
      </Badge>
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Đơn đặt hàng</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý đơn đặt hàng từ nhà cung cấp
            </p>
          </div>
          <Button onClick={() => navigate('/inventory/purchase-orders/new')}>
            Tạo đơn đặt hàng
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-4 sm:mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng đơn hàng</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chờ duyệt</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders?.filter((po) => po.status === 'pending_approval').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã duyệt</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders?.filter((po) => po.status === 'approved').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng giá trị</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                purchaseOrders?.reduce((sum, po) => sum + Number(po.total_amount), 0) || 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="outline"
          onClick={() => setIsFilterOpen(true)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Lọc
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-full px-2">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetContent className="overflow-y-auto sm:max-w-lg">
            <SheetHeader className="px-6">
              <SheetTitle>Bộ lọc</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-6 py-6">
              <div className="space-y-2">
                <Label>Tìm kiếm</Label>
                <Input
                  placeholder="Mã đơn hàng, nhà cung cấp..."
                  value={localFilters.search || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, search: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={localFilters.status || ''}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, status: value as PurchaseOrderStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Select
                  value={localFilters.supplier_id || ''}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, supplier_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhà cung cấp" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers && suppliers.length > 0 ? (
                      suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Không có nhà cung cấp nào
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Trạng thái thanh toán</Label>
                <Select
                  value={localFilters.payment_status || ''}
                  onValueChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      payment_status: value as PurchaseOrderPaymentStatus,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái thanh toán" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ngày đặt hàng từ</Label>
                <Input
                  type="date"
                  value={localFilters.order_date_from || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, order_date_from: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Ngày đặt hàng đến</Label>
                <Input
                  type="date"
                  value={localFilters.order_date_to || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, order_date_to: e.target.value })
                  }
                />
              </div>
            </div>
            <SheetFooter className="px-6 pb-6">
              <Button variant="outline" onClick={handleClearFilters} className="w-full">
                Xóa bộ lọc
              </Button>
              <Button onClick={handleApplyFilters} className="w-full">
                Áp dụng
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Bộ lọc đang áp dụng:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Tìm kiếm: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter('search')}
              />
            </Badge>
          )}
          {filters.supplier_id && (
            <Badge variant="secondary" className="gap-1">
              NCC: {suppliers?.find((s) => s.id === filters.supplier_id)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter('supplier_id')}
              />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Trạng thái: {STATUS_OPTIONS.find((s) => s.value === filters.status)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter('status')}
              />
            </Badge>
          )}
          {filters.payment_status && (
            <Badge variant="secondary" className="gap-1">
              TT thanh toán:{' '}
              {PAYMENT_STATUS_OPTIONS.find((s) => s.value === filters.payment_status)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter('payment_status')}
              />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7"
          >
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã đơn hàng</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Ngày đặt</TableHead>
              <TableHead>Tổng tiền</TableHead>
              <TableHead>Đã thanh toán</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>TT thanh toán</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : purchaseOrders && purchaseOrders.length > 0 ? (
              purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/inventory/purchase-orders/${po.id}`}
                      className="hover:underline"
                    >
                      {po.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{po.suppliers?.name || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(po.order_date), 'dd/MM/yyyy', { locale: vi })}
                  </TableCell>
                  <TableCell>{formatCurrency(Number(po.total_amount))}</TableCell>
                  <TableCell>{formatCurrency(Number(po.paid_amount))}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell>{getPaymentStatusBadge(po.payment_status)}</TableCell>
                  <TableCell className="text-right">
                    <Link to={`/inventory/purchase-orders/${po.id}`}>
                      <Button variant="ghost" size="sm">
                        Chi tiết
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Không có đơn đặt hàng nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
