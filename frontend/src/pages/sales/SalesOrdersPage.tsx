import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Package } from 'lucide-react';
import { salesApi, type SalesOrderQueryParams } from '@/lib/api/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';

export function SalesOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract filters from URL
  const filters: SalesOrderQueryParams = {
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    payment_status: searchParams.get('payment_status') || undefined,
    channel: searchParams.get('channel') || undefined,
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
  };

  // Fetch sales orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['sales-orders', filters],
    queryFn: () => salesApi.getAll(filters),
  });

  // Calculate statistics
  const stats = ordersData?.data
    ? {
        totalOrders: ordersData.meta.total,
        totalRevenue: ordersData.data.reduce((sum, order) => sum + Number(order.total_amount), 0),
        pendingOrders: ordersData.data.filter(o => o.status === 'pending').length,
        completedOrders: ordersData.data.filter(o => o.status === 'completed').length,
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      confirmed: 'default',
      processing: 'default',
      ready: 'default',
      completed: 'default',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      processing: 'Đang xử lý',
      ready: 'Sẵn sàng',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      unpaid: 'destructive',
      partial: 'secondary',
      paid: 'default',
      refunded: 'outline',
    };
    const labels: Record<string, string> = {
      unpaid: 'Chưa thanh toán',
      partial: 'Thanh toán một phần',
      paid: 'Đã thanh toán',
      refunded: 'Đã hoàn tiền',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'order_number',
      header: 'Mã đơn',
      cell: ({ row }) => (
        <div className="font-mono font-medium">{row.original.order_number}</div>
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
      cell: ({ row }) => {
        const channels: Record<string, string> = {
          retail_store: 'Cửa hàng',
          workshop: 'Xưởng',
          online: 'Trực tuyến',
          phone: 'Điện thoại',
        };
        return <div className="text-sm">{channels[row.original.channel] || row.original.channel}</div>;
      },
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
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'payment_status',
      header: 'Thanh toán',
      cell: ({ row }) => getPaymentStatusBadge(row.original.payment_status),
    },
    {
      accessorKey: 'created_at',
      header: 'Ngày tạo',
      cell: ({ row }) => (
        <div className="text-sm">{formatDateTime(row.original.created_at)}</div>
      ),
    },
  ];

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
          <Button>
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
      </div>

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={ordersData?.data || []}
        isLoading={isLoading}
      />
    </div>
  );
}
