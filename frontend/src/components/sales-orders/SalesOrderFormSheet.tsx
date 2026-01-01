import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  salesApi,
  type CreateSalesOrderDto,
  type CreateSalesOrderItemDto,
  type SalesChannel,
  type DiscountType,
  SALES_CHANNEL_LABELS,
} from '@/lib/api/sales';
import { customersApi } from '@/lib/api/customers';
import { productsApi } from '@/lib/api/products';
import { storesApi } from '@/lib/api/stores';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SalesOrderFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  channel: SalesChannel;
  store_id: string;
  discount_type: DiscountType;
  discount_percent: number;
  discount_amount: number;
  notes: string;
}

interface ItemFormData {
  product_id: string;
  product_variant_id: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

export function SalesOrderFormSheet({
  open,
  onOpenChange,
  onSuccess,
}: SalesOrderFormSheetProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<(CreateSalesOrderItemDto & { product_name?: string; variant_name?: string })[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel>('retail_store');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      channel: 'retail_store',
      store_id: '',
      discount_type: 'fixed',
      discount_percent: 0,
      discount_amount: 0,
      notes: '',
    },
  });

  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    reset: resetItem,
    watch: watchItem,
  } = useForm<ItemFormData>({
    defaultValues: {
      product_id: '',
      product_variant_id: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
    },
  });

  const discountPercent = watch('discount_percent');
  const discountAmountInput = watch('discount_amount');
  const quantityItem = watchItem('quantity');
  const unitPriceItem = watchItem('unit_price');

  // Fetch customers
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  // Fetch products
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  });

  // Fetch stores
  const { data: storesData, isLoading: isLoadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: storesApi.getAll,
  });

  const customers = customersData?.data || [];
  const products = productsResponse?.data || [];
  const stores = storesData || [];
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  // Calculate discount amount
  const calculatedDiscountAmount = discountType === 'percent'
    ? (subtotal * discountPercent) / 100
    : discountAmountInput;

  // Calculate total
  const totalAmount = subtotal - calculatedDiscountAmount;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateSalesOrderDto) => salesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      handleClose();
      toast.success('Tạo đơn hàng thành công');
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng');
    },
  });

  // Handle customer selection
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer) {
        setValue('customer_name', customer.full_name);
        setValue('customer_phone', customer.phone || '');
        setValue('customer_email', customer.email || '');
      }
    }
  }, [selectedCustomerId, customers, setValue]);

  const onSubmit = (data: FormData) => {
    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm');
      return;
    }

    if (!selectedStoreId) {
      toast.error('Vui lòng chọn cửa hàng');
      return;
    }

    const createDto: CreateSalesOrderDto = {
      customer_id: selectedCustomerId || undefined,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone || undefined,
      customer_email: data.customer_email || undefined,
      channel: selectedChannel,
      store_id: selectedStoreId,
      discount_type: discountType,
      discount_percent: discountType === 'percent' ? discountPercent : undefined,
      discount_amount: calculatedDiscountAmount,
      notes: data.notes || undefined,
      items: items.map((item) => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || undefined,
      })),
    };

    createMutation.mutate(createDto);
  };

  const onAddItem = (data: ItemFormData) => {
    if (!selectedProductId) {
      toast.error('Vui lòng chọn sản phẩm');
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const variant = selectedVariantId
      ? product.product_variants?.find((v) => v.id === selectedVariantId)
      : undefined;

    const newItem: CreateSalesOrderItemDto & { product_name?: string; variant_name?: string } = {
      product_id: selectedProductId,
      product_variant_id: selectedVariantId || undefined,
      product_name: product.name,
      variant_name: variant?.name,
      quantity: data.quantity,
      unit_price: data.unit_price,
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
    setItems([]);
    setIsAddingItem(false);
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedCustomerId('');
    setSelectedStoreId('');
    setSelectedChannel('retail_store');
    setDiscountType('fixed');
    onOpenChange(false);
  };

  // Set unit price when product/variant changes
  useEffect(() => {
    if (selectedProductId) {
      const product = products.find((p) => p.id === selectedProductId);
      if (product) {
        // Use sale_price if available and within valid dates, otherwise retail_price
        const basePrice = product.sale_price ?? product.retail_price;
        if (selectedVariantId) {
          const variant = product.product_variants?.find((v) => v.id === selectedVariantId);
          if (variant) {
            // Variant price = base price + adjustment
            const variantPrice = basePrice + (variant.price_adjustment || 0);
            resetItem((prev) => ({ ...prev, unit_price: Number(variantPrice) }));
          }
        } else if (basePrice) {
          resetItem((prev) => ({ ...prev, unit_price: Number(basePrice) }));
        }
      }
    }
  }, [selectedProductId, selectedVariantId, products, resetItem]);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>Tạo đơn hàng mới</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
          {/* Store Selection */}
          <div className="space-y-2">
            <Label>
              Cửa hàng <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn cửa hàng" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingStores ? (
                  <SelectItem value="loading" disabled>Đang tải...</SelectItem>
                ) : stores.length > 0 ? (
                  stores.filter((s) => s.is_active).map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Không có cửa hàng</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Sales Channel */}
          <div className="space-y-2">
            <Label>
              Kênh bán hàng <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as SalesChannel)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn kênh bán hàng" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SALES_CHANNEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>Khách hàng</Label>
            <Select
              value={selectedCustomerId || 'walk-in'}
              onValueChange={(value) => setSelectedCustomerId(value === 'walk-in' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn khách hàng (tùy chọn)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Khách vãng lai</SelectItem>
                {isLoadingCustomers ? (
                  <SelectItem value="loading" disabled>Đang tải...</SelectItem>
                ) : customers.length > 0 ? (
                  customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} {customer.phone && `(${customer.phone})`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Không có khách hàng</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">
                Tên khách hàng <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customer_name"
                {...register('customer_name', { required: 'Vui lòng nhập tên khách hàng' })}
                placeholder="Nhập tên khách hàng"
              />
              {errors.customer_name && (
                <p className="text-sm text-red-500">{errors.customer_name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Số điện thoại</Label>
                <Input
                  id="customer_phone"
                  {...register('customer_phone')}
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  {...register('customer_email')}
                  placeholder="Nhập email"
                />
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>
                Sản phẩm <span className="text-red-500">*</span>
              </Label>
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
                  <Label>Sản phẩm</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={(value) => {
                      setSelectedProductId(value);
                      setSelectedVariantId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn sản phẩm" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingProducts ? (
                        <SelectItem value="loading" disabled>Đang tải...</SelectItem>
                      ) : products.length > 0 ? (
                        products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} {product.sku && `(${product.sku})`}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Không có sản phẩm</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct?.product_variants && selectedProduct.product_variants.length > 0 && (
                  <div className="space-y-2">
                    <Label>Phân loại</Label>
                    <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                      <SelectTrigger>
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
                    <Label htmlFor="quantity">Số lượng</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      {...registerItem('quantity', { required: true, valueAsNumber: true, min: 1 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_price">Đơn giá (VND)</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="1000"
                      min="0"
                      {...registerItem('unit_price', { required: true, valueAsNumber: true, min: 0 })}
                    />
                  </div>
                </div>

                <div className="rounded-md bg-background p-3">
                  <div className="flex justify-between text-sm">
                    <span>Thành tiền:</span>
                    <span className="font-semibold">{formatCurrency(quantityItem * unitPriceItem)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleSubmitItem(onAddItem)}>
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
                      <TableHead className="text-right">SL</TableHead>
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
                              <div className="text-sm text-muted-foreground">{item.variant_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
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
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Discount Section */}
          <div className="space-y-4">
            <Label>Giảm giá</Label>
            <RadioGroup
              value={discountType}
              onValueChange={(v) => setDiscountType(v as DiscountType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="fixed" />
                <Label htmlFor="fixed" className="font-normal">Số tiền cố định</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percent" id="percent" />
                <Label htmlFor="percent" className="font-normal">Phần trăm</Label>
              </div>
            </RadioGroup>

            {discountType === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="discount_amount">Số tiền giảm (VND)</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  step="1000"
                  min="0"
                  max={subtotal}
                  {...register('discount_amount', { valueAsNumber: true })}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="discount_percent">Phần trăm giảm (%)</Label>
                <Input
                  id="discount_percent"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  {...register('discount_percent', { valueAsNumber: true })}
                />
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="border rounded-md p-4 space-y-2 bg-muted/50">
            <div className="flex justify-between">
              <span>Tạm tính:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>Giảm giá:</span>
              <span>-{formatCurrency(calculatedDiscountAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Tổng cộng:</span>
              <span className="text-xl font-bold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Ghi chú cho đơn hàng..."
              rows={3}
            />
          </div>
        </form>

        <SheetFooter className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={createMutation.isPending || items.length === 0}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo...
              </>
            ) : (
              'Tạo đơn hàng'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
