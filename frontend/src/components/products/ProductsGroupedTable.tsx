import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, MoreHorizontal, Edit, Trash2, Eye, Package } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { productsApi, type Product } from '@/lib/api/products';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface ProductsGroupedTableProps {
  data: Product[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ProductsGroupedTable({ data, isLoading, onRefresh }: ProductsGroupedTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());

  // Group products: separate master products and standalone products
  const masterProducts = data.filter(p => p.master_product_id === null);

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
  });

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleExpand = (masterId: string) => {
    setExpandedMasters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(masterId)) {
        newSet.delete(masterId);
      } else {
        newSet.add(masterId);
      }
      return newSet;
    });
  };

  // Fetch variants for expanded masters
  const useVariants = (masterId: string, isExpanded: boolean) => {
    return useQuery({
      queryKey: ['productVariants', masterId],
      queryFn: () => productsApi.getVariants(masterId),
      enabled: isExpanded,
    });
  };

  const MasterProductRow = ({ product }: { product: Product }) => {
    const isExpanded = expandedMasters.has(product.id);
    const { data: variants, isLoading: variantsLoading } = useVariants(product.id, isExpanded);

    return (
      <>
        {/* Master Product Row */}
        <TableRow className="bg-muted/50">
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpand(product.id)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </TableCell>
          <TableCell className="font-mono text-sm font-medium">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {product.sku}
            </div>
          </TableCell>
          <TableCell>
            <div>
              <div className="font-medium">{product.name}</div>
              {product.description && (
                <div className="text-sm text-muted-foreground truncate max-w-md">
                  {product.description}
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>
            {product.product_categories?.name && (
              <Badge variant="outline">{product.product_categories.name}</Badge>
            )}
          </TableCell>
          <TableCell>
            {product.brands?.name && (
              <Badge variant="secondary">{product.brands.name}</Badge>
            )}
          </TableCell>
          <TableCell className="text-right">
            {formatCurrency(product.retail_price)}
          </TableCell>
          <TableCell className="text-center">
            <Badge variant="outline">
              {variants?.length || 0} biến thể
            </Badge>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={product.is_active ? 'default' : 'secondary'}>
              {product.is_active ? 'Hoạt động' : 'Ngừng'}
            </Badge>
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/inventory/products/${product.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Xem chi tiết
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/inventory/products/${product.id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(product.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>

        {/* Variant Rows */}
        {isExpanded && (
          <>
            {variantsLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                  Đang tải biến thể...
                </TableCell>
              </TableRow>
            ) : variants && variants.length > 0 ? (
              variants.map((variant) => (
                <TableRow key={variant.id} className="bg-background">
                  <TableCell></TableCell>
                  <TableCell className="font-mono text-sm pl-8">
                    <span className="text-muted-foreground">↳</span> {variant.sku}
                  </TableCell>
                  <TableCell className="pl-8">
                    <div className="text-sm">{variant.name}</div>
                    {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(variant.attributes as Record<string, string>).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(variant.retail_price)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={(variant.quantity_on_hand ?? 0) > 0 ? 'default' : 'destructive'}>
                      {variant.quantity_on_hand ?? 0} trong kho
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                      {variant.is_active ? 'Hoạt động' : 'Ngừng'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/inventory/products/${variant.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Xem chi tiết
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/inventory/products/${variant.id}/edit`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(variant.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                  Không có biến thể
                </TableCell>
              </TableRow>
            )}
          </>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Tên sản phẩm</TableHead>
            <TableHead>Danh mục</TableHead>
            <TableHead>Thương hiệu</TableHead>
            <TableHead className="text-right">Giá bán</TableHead>
            <TableHead className="text-center">Biến thể/Tồn kho</TableHead>
            <TableHead className="text-center">Trạng thái</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {masterProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">Không tìm thấy sản phẩm nào</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            masterProducts.map((product) => (
              <MasterProductRow key={product.id} product={product} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
