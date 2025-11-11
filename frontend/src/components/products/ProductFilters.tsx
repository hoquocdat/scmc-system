import { useForm } from 'react-hook-form';
import type { ProductQueryParams } from '@/lib/api/products';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProductFiltersProps {
  filters: ProductQueryParams;
  onApply: (filters: Partial<ProductQueryParams>) => void;
}

export function ProductFilters({ filters, onApply }: ProductFiltersProps) {
  const { handleSubmit, setValue, watch, reset } = useForm<ProductQueryParams>({
    defaultValues: filters,
  });

  const onSubmit = (data: ProductQueryParams) => {
    onApply(data);
  };

  const handleClear = () => {
    reset({
      category_id: undefined,
      brand_id: undefined,
      supplier_id: undefined,
      product_type: undefined,
      is_active: undefined,
      is_featured: undefined,
    });
    onApply({});
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Product Type */}
      <div className="space-y-2">
        <Label>Loại sản phẩm</Label>
        <Select
          value={watch('product_type') || 'all'}
          onValueChange={(value) => setValue('product_type', value === 'all' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả loại sản phẩm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại sản phẩm</SelectItem>
            <SelectItem value="physical">Hàng hóa vật lý</SelectItem>
            <SelectItem value="service">Dịch vụ</SelectItem>
            <SelectItem value="digital">Sản phẩm số</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Status */}
      <div className="space-y-2">
        <Label>Trạng thái</Label>
        <Select
          value={
            watch('is_active') === undefined
              ? 'all'
              : watch('is_active')
              ? 'true'
              : 'false'
          }
          onValueChange={(value) => {
            if (value === 'all') {
              setValue('is_active', undefined);
            } else {
              setValue('is_active', value === 'true');
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="true">Đang hoạt động</SelectItem>
            <SelectItem value="false">Ngưng bán</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Featured */}
      <div className="space-y-2">
        <Label>Sản phẩm nổi bật</Label>
        <Select
          value={watch('is_featured') ? 'true' : 'false'}
          onValueChange={(value) => setValue('is_featured', value === 'true')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Tất cả sản phẩm</SelectItem>
            <SelectItem value="true">Chỉ sản phẩm nổi bật</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={handleClear} className="flex-1">
          Xóa bộ lọc
        </Button>
        <Button type="submit" className="flex-1">
          Áp dụng
        </Button>
      </div>
    </form>
  );
}
