import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { StockAdjustmentSheet } from '@/components/inventory/StockAdjustmentSheet';
import { formatDateTime } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';

export function StockAdjustmentsPage() {
  const [isAdjustmentSheetOpen, setIsAdjustmentSheetOpen] = useState(false);

  // Fetch transaction history (adjustments only)
  const { data: transactionsData, isLoading, refetch } = useQuery({
    queryKey: ['inventory', 'transactions', 'adjustments'],
    queryFn: () => inventoryApi.getTransactionHistory(undefined, undefined, undefined, 1, 50),
  });

  // Filter only adjustment transactions
  const adjustments = transactionsData?.data?.filter(
    (t: any) => t.transaction_type === 'ADJUST'
  ) || [];

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'created_at',
      header: 'Ngày điều chỉnh',
      cell: ({ row }) => (
        <div className="text-sm">{formatDateTime(row.original.created_at)}</div>
      ),
    },
    {
      accessorKey: 'products.sku',
      header: 'Sản phẩm',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.products?.name || 'N/A'}
          </div>
          <div className="text-sm text-muted-foreground font-mono">
            {row.original.products?.sku || '—'}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'stock_locations.name',
      header: 'Địa điểm',
      cell: ({ row }) => (
        <div className="text-sm">{row.original.stock_locations?.name || '—'}</div>
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Số lượng',
      cell: ({ row }) => {
        const qty = row.original.quantity;
        const isIncrease = qty > 0;
        return (
          <div className={`font-medium ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
            {isIncrease ? '+' : ''}{qty}
          </div>
        );
      },
    },
    {
      accessorKey: 'notes',
      header: 'Lý do',
      cell: ({ row }) => (
        <div className="text-sm max-w-md truncate">
          {row.original.notes || '—'}
        </div>
      ),
    },
    {
      accessorKey: 'user_profiles.full_name',
      header: 'Người thực hiện',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.user_profiles?.full_name || 'Hệ thống'}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Loại',
      cell: ({ row }) => {
        const qty = row.original.quantity;
        return (
          <Badge variant={qty > 0 ? 'default' : 'secondary'}>
            {qty > 0 ? 'Nhập kho' : 'Xuất kho'}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Điều chỉnh tồn kho</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý các điều chỉnh nhập/xuất kho thủ công
            </p>
          </div>
          <Button onClick={() => setIsAdjustmentSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Điều chỉnh tồn kho
          </Button>
        </div>
      </div>

      {/* Adjustments Table */}
      <DataTable
            columns={columns}
            data={adjustments}
            isLoading={isLoading}
          />

      {/* Adjustment Sheet */}
      <StockAdjustmentSheet
        open={isAdjustmentSheetOpen}
        onOpenChange={setIsAdjustmentSheetOpen}
        onSuccess={() => {
          refetch();
          setIsAdjustmentSheetOpen(false);
        }}
      />
    </div>
  );
}
