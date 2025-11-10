import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, type CreateProductDto, type Product } from '@/lib/api/products';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSuccess?: () => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateProductDto>({
    defaultValues: product || {
      product_type: 'physical',
      is_active: true,
      is_featured: false,
      reorder_point: 0,
      reorder_quantity: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.create(data),
    onSuccess: () => {
      toast.success('Đã tạo sản phẩm thành công');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể tạo sản phẩm');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateProductDto) =>
      productsApi.update(product!.id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật sản phẩm thành công');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể cập nhật sản phẩm');
    },
  });

  const onSubmit = (data: CreateProductDto) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </DialogTitle>
          <DialogDescription>
            Nhập thông tin sản phẩm. Các trường đánh dấu * là bắt buộc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium">Thông tin cơ bản</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">
                  SKU <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sku"
                  {...register('sku', { required: 'SKU là bắt buộc' })}
                  placeholder="VD: PART-001"
                />
                {errors.sku && (
                  <p className="text-sm text-destructive">{errors.sku.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên sản phẩm <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Tên sản phẩm là bắt buộc' })}
                  placeholder="VD: Dây curoa chính"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Mô tả chi tiết về sản phẩm"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_type">Loại sản phẩm</Label>
              <Select
                defaultValue={watch('product_type') || 'physical'}
                onValueChange={(value) => setValue('product_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">Hàng hóa vật lý</SelectItem>
                  <SelectItem value="service">Dịch vụ</SelectItem>
                  <SelectItem value="digital">Sản phẩm số</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium">Giá cả</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price">Giá vốn</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  {...register('cost_price', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retail_price">
                  Giá bán <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="retail_price"
                  type="number"
                  step="0.01"
                  {...register('retail_price', {
                    required: 'Giá bán là bắt buộc',
                    valueAsNumber: true,
                    min: { value: 0, message: 'Giá bán phải lớn hơn 0' },
                  })}
                  placeholder="0"
                />
                {errors.retail_price && (
                  <p className="text-sm text-destructive">
                    {errors.retail_price.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sale_price">Giá khuyến mãi</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  {...register('sale_price', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_price_start_date">Từ ngày</Label>
                <Input
                  id="sale_price_start_date"
                  type="date"
                  {...register('sale_price_start_date')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_price_end_date">Đến ngày</Label>
                <Input
                  id="sale_price_end_date"
                  type="date"
                  {...register('sale_price_end_date')}
                />
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div className="space-y-4">
            <h3 className="font-medium">Tồn kho</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reorder_point">Điểm đặt hàng lại</Label>
                <Input
                  id="reorder_point"
                  type="number"
                  {...register('reorder_point', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorder_quantity">Số lượng đặt hàng</Label>
                <Input
                  id="reorder_quantity"
                  type="number"
                  {...register('reorder_quantity', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Dimensions & Weight */}
          <div className="space-y-4">
            <h3 className="font-medium">Kích thước & Trọng lượng</h3>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Trọng lượng (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  {...register('weight', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensions_length">Dài (cm)</Label>
                <Input
                  id="dimensions_length"
                  type="number"
                  step="0.01"
                  {...register('dimensions_length', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensions_width">Rộng (cm)</Label>
                <Input
                  id="dimensions_width"
                  type="number"
                  step="0.01"
                  {...register('dimensions_width', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensions_height">Cao (cm)</Label>
                <Input
                  id="dimensions_height"
                  type="number"
                  step="0.01"
                  {...register('dimensions_height', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="font-medium">Trạng thái</h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Đang hoạt động</Label>
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_featured">Sản phẩm nổi bật</Label>
              <Switch
                id="is_featured"
                checked={watch('is_featured')}
                onCheckedChange={(checked) => setValue('is_featured', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : isEditing ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
