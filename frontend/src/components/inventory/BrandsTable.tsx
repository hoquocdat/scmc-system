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
import { Pencil, Trash2 } from 'lucide-react';
import type { Brand } from '@/lib/api/brands';

interface BrandsTableProps {
  brands: Brand[];
  isLoading: boolean;
  onEdit: (brand: Brand) => void;
  onDelete: (id: string) => void;
}

export function BrandsTable({
  brands,
  isLoading,
  onEdit,
  onDelete,
}: BrandsTableProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Đang tải dữ liệu...
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Chưa có thương hiệu nào</p>
        <p className="text-sm mt-2">Nhấn "Thêm Thương hiệu" để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên thương hiệu</TableHead>
            <TableHead>Quốc gia</TableHead>
            <TableHead>Mô tả</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.map((brand) => (
            <TableRow key={brand.id}>
              <TableCell className="font-semibold">{brand.name}</TableCell>
              <TableCell>
                {brand.country_of_origin || (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-md">
                {brand.description ? (
                  <span className="text-sm line-clamp-2">
                    {brand.description}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                  {brand.is_active ? 'Hoạt động' : 'Không hoạt động'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(brand)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(brand.id)}
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
