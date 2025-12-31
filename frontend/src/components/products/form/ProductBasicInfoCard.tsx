import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProductFormProps } from './types';

interface ProductBasicInfoCardProps extends ProductFormProps {
  idPrefix?: string;
}

export function ProductBasicInfoCard({
  register,
  errors,
  watch,
  setValue,
  idPrefix = '',
}: ProductBasicInfoCardProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin cơ bản</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}sku`}>SKU *</Label>
            <Input
              id={`${prefix}sku`}
              {...register('sku')}
              placeholder="VD: PROD-001"
            />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}product_type`}>Loại sản phẩm</Label>
            <Select
              value={watch('product_type') || 'physical'}
              onValueChange={(value) => setValue('product_type', value as 'physical' | 'service' | 'digital')}
            >
              <SelectTrigger id={`${prefix}product_type`}>
                <SelectValue placeholder="Chọn loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="physical">Hàng hóa vật lý</SelectItem>
                <SelectItem value="service">Dịch vụ</SelectItem>
                <SelectItem value="digital">Sản phẩm số</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${prefix}name`}>Tên sản phẩm *</Label>
          <Input
            id={`${prefix}name`}
            {...register('name')}
            placeholder="VD: Bộ xích nhông"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${prefix}description`}>Mô tả</Label>
          <Textarea
            id={`${prefix}description`}
            {...register('description')}
            placeholder="Mô tả sản phẩm..."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
