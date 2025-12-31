import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { ProductFormProps } from './types';

interface ProductInventoryCardProps extends ProductFormProps {
  idPrefix?: string;
}

export function ProductInventoryCard({
  register,
  idPrefix = '',
}: ProductInventoryCardProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kho hàng & Vận chuyển</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}reorder_point`}>Điểm đặt hàng lại</Label>
            <Input
              id={`${prefix}reorder_point`}
              type="number"
              {...register('reorder_point', { valueAsNumber: true })}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}reorder_quantity`}>Số lượng đặt hàng</Label>
            <Input
              id={`${prefix}reorder_quantity`}
              type="number"
              {...register('reorder_quantity', { valueAsNumber: true })}
              placeholder="50"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}weight`}>Trọng lượng (kg)</Label>
            <Input
              id={`${prefix}weight`}
              type="number"
              step="0.01"
              {...register('weight', { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}dimensions_length`}>Dài (cm)</Label>
            <Input
              id={`${prefix}dimensions_length`}
              type="number"
              step="0.1"
              {...register('dimensions_length', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}dimensions_width`}>Rộng (cm)</Label>
            <Input
              id={`${prefix}dimensions_width`}
              type="number"
              step="0.1"
              {...register('dimensions_width', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}dimensions_height`}>Cao (cm)</Label>
            <Input
              id={`${prefix}dimensions_height`}
              type="number"
              step="0.1"
              {...register('dimensions_height', { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
