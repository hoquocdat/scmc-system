import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProductFormProps, Category, Brand, Supplier } from './types';

interface ProductOrganizationCardProps extends Pick<ProductFormProps, 'watch' | 'setValue'> {
  categories: Category[];
  brands: Brand[];
  suppliers: Supplier[];
  idPrefix?: string;
}

export function ProductOrganizationCard({
  watch,
  setValue,
  categories,
  brands,
  suppliers,
  idPrefix = '',
}: ProductOrganizationCardProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phân loại</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}category_id`}>Danh mục</Label>
          <Select
            value={watch('category_id') || undefined}
            onValueChange={(value) => setValue('category_id', value === '_none' ? undefined : value)}
          >
            <SelectTrigger id={`${prefix}category_id`}>
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">-- Không chọn --</SelectItem>
              {categories
                .filter((cat) => cat.is_active || cat.id === watch('category_id'))
                .sort((a, b) => a.display_order - b.display_order)
                .map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}brand_id`}>Thương hiệu</Label>
          <Select
            value={watch('brand_id') || undefined}
            onValueChange={(value) => setValue('brand_id', value === '_none' ? undefined : value)}
          >
            <SelectTrigger id={`${prefix}brand_id`}>
              <SelectValue placeholder="Chọn thương hiệu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">-- Không chọn --</SelectItem>
              {brands
                .filter((brand) => brand.is_active || brand.id === watch('brand_id'))
                .map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}supplier_id`}>Nhà cung cấp</Label>
          <Select
            value={watch('supplier_id') || undefined}
            onValueChange={(value) => setValue('supplier_id', value === '_none' ? undefined : value)}
          >
            <SelectTrigger id={`${prefix}supplier_id`}>
              <SelectValue placeholder="Chọn nhà cung cấp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">-- Không chọn --</SelectItem>
              {suppliers
                .filter((supplier) => supplier.is_active || supplier.id === watch('supplier_id'))
                .map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
