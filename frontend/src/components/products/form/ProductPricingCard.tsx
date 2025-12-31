import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CurrencyInput } from '@/components/ui/currency-input';
import type { ProductFormProps } from './types';

interface ProductPricingCardProps extends ProductFormProps {
  idPrefix?: string;
  showSalePrice?: boolean;
}

export function ProductPricingCard({
  register,
  errors,
  watch,
  setValue,
  idPrefix = '',
  showSalePrice = true,
}: ProductPricingCardProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giá cả</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}cost_price`}>Giá vốn (VND) *</Label>
            <CurrencyInput
              id={`${prefix}cost_price`}
              value={watch('cost_price') as number | undefined}
              onValueChange={(value) => setValue('cost_price', value as any)}
              placeholder="0"
            />
            {errors.cost_price && (
              <p className="text-sm text-destructive">
                {errors.cost_price.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}retail_price`}>Giá bán lẻ (VND) *</Label>
            <CurrencyInput
              id={`${prefix}retail_price`}
              value={watch('retail_price')}
              onValueChange={(value) => setValue('retail_price', value || 0)}
              placeholder="0"
            />
            {errors.retail_price && (
              <p className="text-sm text-destructive">
                {errors.retail_price.message}
              </p>
            )}
          </div>
        </div>

        {showSalePrice && (
          <>
            <Separator />

            <div className="space-y-4">
              <Label>Giá khuyến mãi (Tùy chọn)</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${prefix}sale_price`}>Giá khuyến mãi (VND)</Label>
                  <CurrencyInput
                    id={`${prefix}sale_price`}
                    value={watch('sale_price') as number | undefined}
                    onValueChange={(value) => setValue('sale_price', value as any)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${prefix}sale_price_start_date`}>Ngày bắt đầu</Label>
                  <Input
                    id={`${prefix}sale_price_start_date`}
                    type="date"
                    {...register('sale_price_start_date')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${prefix}sale_price_end_date`}>Ngày kết thúc</Label>
                  <Input
                    id={`${prefix}sale_price_end_date`}
                    type="date"
                    {...register('sale_price_end_date')}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
