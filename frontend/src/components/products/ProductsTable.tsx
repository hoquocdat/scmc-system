import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { productsApi, type Product } from '@/lib/api/products';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

interface ProductsTableProps {
  data: Product[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ProductsTable({ data, isLoading, onRefresh }: ProductsTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa sản phẩm thành công');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onRefresh();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xóa sản phẩm');
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
      setDeletingId(id);
      deleteMutation.mutate(id);
    }
  };

  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.original.sku}</div>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Tên sản phẩm',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.description && (
              <div className="text-sm text-muted-foreground truncate max-w-md">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'product_categories.name',
        header: 'Danh mục',
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.product_categories?.name || '—'}
          </div>
        ),
      },
      {
        accessorKey: 'brands.name',
        header: 'Thương hiệu',
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.brands?.name || '—'}
          </div>
        ),
      },
      {
        accessorKey: 'retail_price',
        header: 'Giá bán',
        cell: ({ row }) => (
          <div className="font-medium">
            {formatCurrency(row.original.retail_price)}
          </div>
        ),
      },
      {
        accessorKey: 'cost_price',
        header: 'Giá vốn',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.cost_price
              ? formatCurrency(row.original.cost_price)
              : '—'}
          </div>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
            {row.original.is_active ? 'Hoạt động' : 'Ngưng bán'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const product = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate(`/inventory/products/${product.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Xem chi tiết
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(`/inventory/products/${product.id}/edit`)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDelete(product.id)}
                  disabled={deletingId === product.id}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, deletingId]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
    />
  );
}
