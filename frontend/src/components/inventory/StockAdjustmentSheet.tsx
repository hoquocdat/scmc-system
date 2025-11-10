import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api/inventory';
import { productsApi } from '@/lib/api/products';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StockAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface AdjustmentForm {
  locationId: string;
  productId: string;
  quantity: number;
  reason: string;
}

export function StockAdjustmentSheet({
  open,
  onOpenChange,
  onSuccess,
}: StockAdjustmentSheetProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AdjustmentForm>();

  // Fetch products for selection
  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 100 }],
    queryFn: () => productsApi.getAll({ limit: 100 }),
    enabled: open,
  });

  const adjustMutation = useMutation({
    mutationFn: (data: AdjustmentForm) =>
      inventoryApi.adjustStock({
        locationId: data.locationId,
        productId: data.productId,
        quantity: data.quantity,
        reason: data.reason,
      }),
    onSuccess: () => {
      toast.success('Đã điều chỉnh tồn kho thành công');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể điều chỉnh tồn kho');
    },
  });

  const onSubmit = (data: AdjustmentForm) => {
    adjustMutation.mutate(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Điều chỉnh tồn kho</SheetTitle>
          <SheetDescription>
            Nhập hoặc xuất kho thủ công. Các trường đánh dấu * là bắt buộc.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="locationId">
              Địa điểm <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(value) => setValue('locationId', value)}
              value={watch('locationId')}
            >
              <SelectTrigger id="locationId">
                <SelectValue placeholder="Chọn địa điểm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hcmc">TP. Hồ Chí Minh</SelectItem>
                <SelectItem value="hanoi">Hà Nội</SelectItem>
                <SelectItem value="workshop">Xưởng</SelectItem>
              </SelectContent>
            </Select>
            {errors.locationId && (
              <p className="text-sm text-destructive">Vui lòng chọn địa điểm</p>
            )}
          </div>

          {/* Product */}
          <div className="space-y-2">
            <Label htmlFor="productId">
              Sản phẩm <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(value) => setValue('productId', value)}
              value={watch('productId')}
            >
              <SelectTrigger id="productId">
                <SelectValue placeholder="Chọn sản phẩm" />
              </SelectTrigger>
              <SelectContent>
                {productsData?.data?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId && (
              <p className="text-sm text-destructive">Vui lòng chọn sản phẩm</p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Số lượng điều chỉnh <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              {...register('quantity', {
                required: 'Số lượng là bắt buộc',
                valueAsNumber: true,
              })}
              placeholder="Nhập số dương để tăng, số âm để giảm"
            />
            <p className="text-xs text-muted-foreground">
              Ví dụ: +10 để thêm 10 sản phẩm, -5 để trừ 5 sản phẩm
            </p>
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Lý do điều chỉnh <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              {...register('reason', { required: 'Lý do là bắt buộc' })}
              placeholder="VD: Hàng bị hỏng, kiểm kê, nhập từ nhà cung cấp..."
              rows={3}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <SheetFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adjustMutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? 'Đang xử lý...' : 'Điều chỉnh'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
