import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { formatCurrency } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';

export function StockLevelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>(
    searchParams.get('location') || undefined
  );

  // Fetch stock levels
  const { data: stockLevels, isLoading } = useQuery({
    queryKey: ['inventory', 'stock-levels', selectedLocation],
    queryFn: () => inventoryApi.getStockLevels(selectedLocation),
  });

  const handleLocationChange = (value: string) => {
    const newLocation = value === 'all' ? undefined : value;
    setSelectedLocation(newLocation);
    const params = new URLSearchParams(searchParams);
    if (newLocation) {
      params.set('location', newLocation);
    } else {
      params.delete('location');
    }
    setSearchParams(params);
  };

  // Calculate statistics
  const stats = stockLevels
    ? {
      totalProducts: stockLevels.length,
      lowStock: stockLevels.filter((item: any) => item.is_low_stock).length,
      outOfStock: stockLevels.filter((item: any) => item.quantity_on_hand === 0).length,
      totalValue: stockLevels.reduce(
        (sum: number, item: any) =>
          sum + (item.quantity_on_hand || 0) * (item.products?.cost_price || 0),
        0
      ),
    }
    : null;

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'products.sku',
      header: 'SKU',
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.original.products?.sku || '—'}</div>
      ),
    },
    {
      accessorKey: 'products.name',
      header: 'Sản phẩm',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.products?.name || 'N/A'}</div>
          <div className="text-sm text-muted-foreground">
            {row.original.stock_locations?.name}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'quantity_on_hand',
      header: 'Tồn kho',
      cell: ({ row }) => {
        const qty = row.original.quantity_on_hand || 0;
        const isLow = row.original.is_low_stock;
        const isOut = qty === 0;

        return (
          <div className="flex items-center gap-2">
            <span className={isOut ? 'text-destructive font-medium' : isLow ? 'text-orange-500 font-medium' : ''}>
              {qty}
            </span>
            {isOut && <Badge variant="destructive">Hết hàng</Badge>}
            {isLow && !isOut && <Badge variant="outline" className="text-orange-500">Sắp hết</Badge>}
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity_available',
      header: 'Có thể bán',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.quantity_available || 0}
        </div>
      ),
    },
    {
      accessorKey: 'quantity_reserved',
      header: 'Đã đặt',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {row.original.quantity_reserved || 0}
        </div>
      ),
    },
    {
      accessorKey: 'quantity_on_order',
      header: 'Đang đặt',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {row.original.quantity_on_order || 0}
        </div>
      ),
    },
    {
      id: 'value',
      header: 'Giá trị tồn',
      cell: ({ row }) => {
        const qty = row.original.quantity_on_hand || 0;
        const cost = row.original.products?.cost_price || 0;
        return (
          <div className="font-medium">
            {formatCurrency(qty * cost)}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        if (row.original.needs_reorder) {
          return (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Cần đặt hàng
            </Badge>
          );
        }
        return <Badge variant="secondary">Bình thường</Badge>;
      },
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Mức tồn kho</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Theo dõi số lượng hàng tồn kho tại các địa điểm
            </p>
          </div>
          <Select
            value={selectedLocation || 'all'}
            onValueChange={handleLocationChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả địa điểm</SelectItem>
              <SelectItem value="hcmc">TP. Hồ Chí Minh</SelectItem>
              <SelectItem value="hanoi">Hà Nội</SelectItem>
              <SelectItem value="workshop">Xưởng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng sản phẩm</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sắp hết hàng</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.lowStock}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hết hàng</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.outOfStock}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Giá trị tồn kho</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stock Levels Table */}
      <DataTable
        columns={columns}
        data={stockLevels || []}
        isLoading={isLoading}
      />
    </div>
  );
}
