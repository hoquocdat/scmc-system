import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ProductFormProps } from './types';

interface ProductStatusCardProps extends Pick<ProductFormProps, 'watch' | 'setValue'> {
  idPrefix?: string;
}

export function ProductStatusCard({
  watch,
  setValue,
  idPrefix = '',
}: ProductStatusCardProps) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trạng thái</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${prefix}is_active`}>Đang hoạt động</Label>
          <Switch
            id={`${prefix}is_active`}
            checked={watch('is_active')}
            onCheckedChange={(checked) => setValue('is_active', checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor={`${prefix}is_featured`}>Nổi bật</Label>
          <Switch
            id={`${prefix}is_featured`}
            checked={watch('is_featured')}
            onCheckedChange={(checked) => setValue('is_featured', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
