import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, FolderTree } from 'lucide-react';
import type { ProductCategory } from '@/lib/api/product-categories';

interface ProductCategoriesTableProps {
  categories: ProductCategory[];
  isLoading: boolean;
  onEdit: (category: ProductCategory) => void;
  onDelete: (id: string) => void;
}

export function ProductCategoriesTable({
  categories,
  isLoading,
  onEdit,
  onDelete,
}: ProductCategoriesTableProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Đang tải dữ liệu...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Chưa có danh mục nào</p>
        <p className="text-sm mt-2">Nhấn "Thêm Danh mục" để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên danh mục</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Danh mục cha</TableHead>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Danh mục con</TableHead>
            <TableHead>Thứ tự</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {category._count && category._count.other_product_categories > 0 && (
                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-semibold">{category.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {category.slug}
                </code>
              </TableCell>
              <TableCell>
                {category.product_categories ? (
                  <span className="text-sm">{category.product_categories.name}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {category._count?.products || 0}
                </Badge>
              </TableCell>
              <TableCell>
                {category._count && category._count.other_product_categories > 0 ? (
                  <Badge variant="secondary">
                    {category._count.other_product_categories}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {category.display_order}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={category.is_active ? 'default' : 'secondary'}>
                  {category.is_active ? 'Hoạt động' : 'Ẩn'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(category)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
