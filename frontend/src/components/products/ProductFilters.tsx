import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import type { ProductQueryParams } from '@/lib/api/products';
import { brandsApi } from '@/lib/api/brands';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  const { handleSubmit, setValue, watch, reset, register } = useForm<ProductQueryParams>({
    defaultValues: filters,
  });

  // Fetch brands and categories
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.getAll(),
  });

  const { data: categories } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => productCategoriesApi.getAll(),
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
      created_from: undefined,
      created_to: undefined,
      stock_status: undefined,
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

      {/* Brand */}
      <div className="space-y-2">
        <Label>Thương hiệu</Label>
        <Select
          value={watch('brand_id') || 'all'}
          onValueChange={(value) => setValue('brand_id', value === 'all' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả thương hiệu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả thương hiệu</SelectItem>
            {brands?.filter(b => b.is_active).map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Category */}
      <div className="space-y-2">
        <Label>Danh mục</Label>
        <Select
          value={watch('category_id') || 'all'}
          onValueChange={(value) => setValue('category_id', value === 'all' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả danh mục" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả danh mục</SelectItem>
            {categories?.filter(c => c.is_active).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label>Thời gian tạo</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Input
              type="date"
              placeholder="Từ ngày"
              {...register('created_from')}
            />
          </div>
          <div>
            <Input
              type="date"
              placeholder="Đến ngày"
              {...register('created_to')}
            />
          </div>
        </div>
      </div>

      {/* Stock Status */}
      <div className="space-y-2">
        <Label>Tồn kho</Label>
        <Select
          value={watch('stock_status') || 'all'}
          onValueChange={(value) => setValue('stock_status', value === 'all' ? undefined : value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="in_stock">Còn hàng</SelectItem>
            <SelectItem value="out_of_stock">Hết hàng</SelectItem>
            <SelectItem value="below_reorder">Dưới định mức tồn</SelectItem>
            <SelectItem value="above_reorder">Vượt định mức tồn</SelectItem>
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
