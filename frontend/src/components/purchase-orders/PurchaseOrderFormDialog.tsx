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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { purchaseOrdersApi, type CreatePurchaseOrderDto, type CreatePurchaseOrderItemDto } from '@/lib/api/purchase-orders';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  supplier_id: string;
  expected_delivery_date: string;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  notes: string;
  internal_notes: string;
}

interface ItemFormData {
  product_id: string;
  product_variant_id: string;
  quantity_ordered: number;
  unit_cost: number;
  notes: string;
}

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: PurchaseOrderFormDialogProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [items, setItems] = useState<CreatePurchaseOrderItemDto[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      supplier_id: '',
      expected_delivery_date: '',
      tax_amount: 0,
      shipping_cost: 0,
      discount_amount: 0,
      notes: '',
      internal_notes: '',
    },
  });

  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    reset: resetItem,
    watch,
  } = useForm<ItemFormData>({
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
  const itemTotal = quantityOrdered * unitCost;

  // Fetch suppliers
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getAll,
  });

  // Fetch products
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  });

  const products = productsResponse?.data || [];
  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderDto) => purchaseOrdersApi.create(data),
    onSuccess: () => {
      reset();
      setSelectedSupplierId('');
      setItems([]);
      onSuccess();
      onOpenChange(false);
      toast.success('Đã tạo đơn đặt hàng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn đặt hàng');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!selectedSupplierId) {
      toast.error('Vui lòng chọn nhà cung cấp');
      return;
    }

    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm');
      return;
    }

    const createDto: CreatePurchaseOrderDto = {
      supplier_id: selectedSupplierId,
      expected_delivery_date: data.expected_delivery_date || undefined,
      tax_amount: data.tax_amount || 0,
      shipping_cost: data.shipping_cost || 0,
      discount_amount: data.discount_amount || 0,
      notes: data.notes || undefined,
      internal_notes: data.internal_notes || undefined,
      items: items,
    };

    createMutation.mutate(createDto);
  };

  const onAddItem = (data: ItemFormData) => {
    if (!selectedProductId) {
      toast.error('Vui lòng chọn sản phẩm');
      return;
    }

    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return;

    const variant = selectedVariantId
      ? product.product_variants?.find((v) => v.id === selectedVariantId)
      : undefined;

    const newItem: CreatePurchaseOrderItemDto = {
      product_id: selectedProductId,
      product_variant_id: selectedVariantId || undefined,
      product_name: product.name,
      product_sku: product.sku || undefined,
      variant_name: variant?.name || undefined,
      quantity_ordered: data.quantity_ordered,
      unit_cost: data.unit_cost,
      notes: data.notes || undefined,
    };

    setItems([...items, newItem]);
    resetItem();
    setSelectedProductId('');
    setSelectedVariantId('');
    setIsAddingItem(false);
    toast.success('Đã thêm sản phẩm');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    toast.success('Đã xóa sản phẩm');
  };

  const handleClose = () => {
    reset();
    resetItem();
    setSelectedSupplierId('');
    setItems([]);
    setIsAddingItem(false);
    setSelectedProductId('');
    setSelectedVariantId('');
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity_ordered * item.unit_cost, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo đơn đặt hàng mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">
              Nhà cung cấp <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Chọn nhà cung cấp" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingSuppliers ? (
                  <SelectItem value="loading" disabled>
                    Đang tải...
                  </SelectItem>
                ) : suppliers && suppliers.length > 0 ? (
                  suppliers
                    .filter((s) => s.is_active)
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>
                    Không có nhà cung cấp nào
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Items Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sản phẩm <span className="text-red-500">*</span></Label>
              {!isAddingItem && (
                <Button type="button" size="sm" onClick={() => setIsAddingItem(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm sản phẩm
                </Button>
              )}
            </div>

            {isAddingItem && (
              <div className="border rounded-md p-4 space-y-4 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="product">Sản phẩm</Label>
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
                    <Label htmlFor="quantity_ordered">Số lượng</Label>
                    <Input
                      id="quantity_ordered"
                      type="number"
                      min="1"
                      {...registerItem('quantity_ordered', {
                        required: true,
                        valueAsNumber: true,
                        min: 1,
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_cost">Đơn giá (VND)</Label>
                    <Input
                      id="unit_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      {...registerItem('unit_cost', {
                        required: true,
                        valueAsNumber: true,
                        min: 0,
                      })}
                    />
                  </div>
                </div>

                <div className="rounded-md bg-background p-3">
                  <div className="flex justify-between text-sm">
                    <span>Thành tiền:</span>
                    <span className="font-semibold">{formatCurrency(itemTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item_notes">Ghi chú</Label>
                  <Textarea
                    id="item_notes"
                    placeholder="Ghi chú cho sản phẩm..."
                    {...registerItem('notes')}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSubmitItem(onAddItem)}
                  >
                    Thêm
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsAddingItem(false);
                      resetItem();
                      setSelectedProductId('');
                      setSelectedVariantId('');
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.product_name}</div>
                            {item.variant_name && (
                              <div className="text-sm text-muted-foreground">
                                {item.variant_name}
                              </div>
                            )}
                            {item.product_sku && (
                              <div className="text-xs text-muted-foreground">
                                SKU: {item.product_sku}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity_ordered * item.unit_cost)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        Tổng phụ:
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(subtotal)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="expected_delivery_date">Ngày giao dự kiến</Label>
            <Input
              id="expected_delivery_date"
              type="date"
              {...register('expected_delivery_date')}
            />
          </div>

          {/* Tax, Shipping, Discount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_amount">Thuế (VND)</Label>
              <Input
                id="tax_amount"
                type="number"
                step="0.01"
                {...register('tax_amount', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping_cost">Phí vận chuyển (VND)</Label>
              <Input
                id="shipping_cost"
                type="number"
                step="0.01"
                {...register('shipping_cost', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_amount">Giảm giá (VND)</Label>
              <Input
                id="discount_amount"
                type="number"
                step="0.01"
                {...register('discount_amount', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú cho đơn đặt hàng..."
              {...register('notes')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal_notes">Ghi chú nội bộ</Label>
            <Textarea
              id="internal_notes"
              placeholder="Ghi chú nội bộ (không hiển thị cho nhà cung cấp)..."
              {...register('internal_notes')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={createMutation.isPending || items.length === 0}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo đơn đặt hàng'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
