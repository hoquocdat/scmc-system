import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
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
import {
  purchaseOrdersApi,
  type AddPurchaseOrderItemDto,
} from '@/lib/api/purchase-orders';
import { productsApi } from '@/lib/api/products';
import { toast } from 'sonner';

interface AddPurchaseOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  onSuccess: () => void;
}

interface FormData {
  product_id: string;
  product_variant_id: string;
  quantity_ordered: number;
  unit_cost: number;
  notes: string;
}

export function AddPurchaseOrderItemDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  onSuccess,
}: AddPurchaseOrderItemDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      product_id: '',
      product_variant_id: '',
      quantity_ordered: 1,
      unit_cost: 0,
      notes: '',
    },
  });

  const quantityOrdered = watch('quantity_ordered');
  const unitCost = watch('unit_cost');
  const totalCost = quantityOrdered * unitCost;

  // Fetch products
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  });

  const products = productsResponse?.data || [];

  // Get selected product
  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: (data: AddPurchaseOrderItemDto) =>
      purchaseOrdersApi.addItem(purchaseOrderId, data),
    onSuccess: () => {
      reset();
      setSelectedProductId('');
      setSelectedVariantId('');
      onSuccess();
      onOpenChange(false);
      toast.success('Đã thêm sản phẩm vào đơn đặt hàng');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi thêm sản phẩm');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!selectedProductId && !selectedVariantId) {
      toast.error('Vui lòng chọn sản phẩm');
      return;
    }

    const addDto: AddPurchaseOrderItemDto = {
      product_id: selectedProductId || undefined,
      product_variant_id: selectedVariantId || undefined,
      product_name: selectedProduct?.name || '',
      product_sku: selectedProduct?.sku || undefined,
      variant_name: selectedVariantId
        ? selectedProduct?.product_variants?.find((v) => v.id === selectedVariantId)?.name
        : undefined,
      quantity_ordered: data.quantity_ordered,
      unit_cost: data.unit_cost,
      notes: data.notes || undefined,
    };

    addItemMutation.mutate(addDto);
  };

  const handleClose = () => {
    reset();
    setSelectedProductId('');
    setSelectedVariantId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Thêm sản phẩm</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">
              Sản phẩm <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedProductId}
              onValueChange={(value) => {
                setSelectedProductId(value);
                setSelectedVariantId('');
              }}
            >
              <SelectTrigger id="product">
                <SelectValue placeholder="Chọn sản phẩm" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingProducts ? (
                  <SelectItem value="loading" disabled>
                    Đang tải...
                  </SelectItem>
                ) : products && products.length > 0 ? (
                  products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} {product.sku && `(${product.sku})`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Không có sản phẩm nào
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct?.product_variants && selectedProduct.product_variants.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="variant">Phân loại</Label>
              <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                <SelectTrigger id="variant">
                  <SelectValue placeholder="Chọn phân loại (tùy chọn)" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct.product_variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.name} {variant.sku && `(${variant.sku})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity_ordered">
                Số lượng <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity_ordered"
                type="number"
                min="1"
                {...register('quantity_ordered', {
                  required: 'Vui lòng nhập số lượng',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Số lượng phải lớn hơn 0' },
                })}
              />
              {errors.quantity_ordered && (
                <p className="text-sm text-red-500">{errors.quantity_ordered.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_cost">
                Đơn giá (VND) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit_cost"
                type="number"
                step="0.01"
                min="0"
                {...register('unit_cost', {
                  required: 'Vui lòng nhập đơn giá',
                  valueAsNumber: true,
                  min: { value: 0, message: 'Đơn giá phải lớn hơn hoặc bằng 0' },
                })}
              />
              {errors.unit_cost && (
                <p className="text-sm text-red-500">{errors.unit_cost.message}</p>
              )}
            </div>
          </div>

          <div className="rounded-md bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span>Thành tiền:</span>
              <span className="font-semibold">
                {new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND',
                }).format(totalCost)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú cho sản phẩm..."
              {...register('notes')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={addItemMutation.isPending}>
              {addItemMutation.isPending ? 'Đang thêm...' : 'Thêm sản phẩm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
