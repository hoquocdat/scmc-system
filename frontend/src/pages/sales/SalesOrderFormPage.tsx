import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  salesApi,
  type CreateSalesOrderDto,
  type DiscountType,
  type SalesOrder,
} from '@/lib/api/sales';
import { PaymentDialog } from '@/components/sales-orders/PaymentDialog';
import { customersApi } from '@/lib/api/customers';
import { ProductSearchInput } from '@/components/inventory/purchase-orders/ProductSearchInput';
import {
  SalesOrderItemsTable,
  CustomerSelectCard,
  SalesOrderTotalsCard,
  SalesOrderNotesCard,
  type SalesOrderItem,
} from '@/components/sales-orders/form';
import { PointRedemptionInput } from '@/components/loyalty/PointRedemptionInput';
import { useStoreStore } from '@/store/storeStore';
import { useQuotedItems } from '@/hooks/useQuotedItems';
import { PriceBookPicker } from '@/components/price-books/PriceBookPicker';
import { OrderPricingCard } from '@/components/promotions/OrderPricingCard';
import { useCartBreakdown } from '@/hooks/useCartBreakdown';

export function SalesOrderFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedStoreId } = useStoreStore();

  const [rawItems, setItems] = useState<SalesOrderItem[]>([]);
  const [priceBookId, setPriceBookId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<SalesOrder | null>(null);
  const [isCreatingWithPayment, setIsCreatingWithPayment] = useState(false);

  // Loyalty redemption state
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltyDiscountAmount, setLoyaltyDiscountAmount] = useState(0);

  // Fetch customers
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  const customers = customersData?.data || [];
  // Lines shown at server prices (base price + price books); the server prices the order again on save
  const { items: quotedItems } = useQuotedItems(selectedStoreId, selectedCustomerId || null, priceBookId, rawItems);
  // Server breakdown: promotions, voucher and points in the fixed discount order
  const breakdown = useCartBreakdown(
    selectedStoreId && rawItems.length
      ? {
          store_id: selectedStoreId,
          customer_id: selectedCustomerId || null,
          price_book_id: priceBookId,
          channel: 'retail_store',
          discount_type: discountType,
          discount_value: discountType === 'percent' ? discountPercent : discountAmount,
          voucher_code: voucherCode,
          points_to_redeem: pointsToRedeem,
          lines: rawItems.map((i) => ({ product_id: i.product_id, product_variant_id: i.product_variant_id, unit_id: i.unit_id ?? null, quantity: i.quantity })),
        }
      : null,
  );
  // Unit lines take the server's unit price (base price × factor or the unit's own price)
  const items = quotedItems.map((it, i) => {
    const line = breakdown.data?.lines[i];
    return it.unit_id && line && line.product_id === it.product_id ? { ...it, unit_price: line.unit_price } : it;
  });

  // Handle customer selection - auto-fill customer info
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer) {
        setCustomerName(customer.full_name);
        setCustomerPhone(customer.phone || '');
        setCustomerEmail(customer.email || '');
      }
    }
  }, [selectedCustomerId, customers]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreateSalesOrderDto) => salesApi.create(dto),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Đã tạo đơn hàng thành công');
      navigate(`/sales/orders/${response.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng');
    },
  });

  // Create and confirm mutation for payment flow
  const createWithPaymentMutation = useMutation({
    mutationFn: async (dto: CreateSalesOrderDto) => {
      // Step 1: Create the order
      const order = await salesApi.create(dto);
      // Step 2: Confirm the order (triggers inventory deduction and receivables)
      const confirmedOrder = await salesApi.confirm(order.id);
      return confirmedOrder;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setCreatedOrder(response);
      setIsPaymentDialogOpen(true);
      setIsCreatingWithPayment(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng');
      setIsCreatingWithPayment(false);
    },
  });

  // Add product to items
  const handleAddProduct = (product: any, variant?: any) => {
    const existingItem = items.find(
      (item) =>
        item.product_id === product.id &&
        (variant ? item.product_variant_id === variant.id : !item.product_variant_id)
    );

    if (existingItem) {
      setItems(
        items.map((item) =>
          item.tempId === existingItem.tempId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      const newItem: SalesOrderItem = {
        tempId: Math.random().toString(36).substr(2, 9),
        product_id: product.id,
        product_variant_id: variant?.id,
        product_name: product.name,
        product_sku: product.sku || undefined,
        variant_name: variant?.name,
        quantity: 1,
        unit_price: Number(product.sale_price || product.retail_price || 0),
        notes: undefined,
      };
      setItems([...items, newItem]);
    }
  };

  // Remove item
  const handleRemoveItem = (tempId: string) => {
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  // Update item quantity
  const handleUpdateQuantity = (tempId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(
      items.map((item) =>
        item.tempId === tempId ? { ...item, quantity } : item
      )
    );
  };

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const calculatedDiscount = discountType === 'percent'
    ? (subtotal * discountPercent) / 100
    : discountAmount;



  // Handler for loyalty redemption changes
  const handleRedemptionChange = (points: number, discount: number) => {
    setPointsToRedeem(points);
    setLoyaltyDiscountAmount(discount);
  };

  // Build DTO helper
  const buildCreateDto = (): CreateSalesOrderDto | null => {
    if (!selectedStoreId) {
      toast.error('Vui lòng chọn cửa hàng làm việc trước khi tạo đơn hàng');
      return null;
    }

    if (!customerName.trim()) {
      toast.error('Vui lòng nhập tên khách hàng');
      return null;
    }

    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm');
      return null;
    }

    return {
      customer_id: selectedCustomerId || undefined,
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      customer_email: customerEmail || undefined,
      channel: 'retail_store',
      store_id: selectedStoreId,
      discount_type: discountType,
      discount_percent: discountType === 'percent' ? discountPercent : undefined,
      discount_amount: calculatedDiscount,
      notes: notes || undefined,
      // Loyalty redemption fields
      points_to_redeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      loyalty_discount_amount: loyaltyDiscountAmount > 0 ? loyaltyDiscountAmount : undefined,
      price_book_id: priceBookId ?? undefined,
      voucher_code: voucherCode ?? undefined,
      expected_total: breakdown.data?.total,
      items: items.map(({ tempId, product_name, product_sku, variant_name, ...item }) => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        unit_id: item.unit_id ?? undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
      })),
    };
  };

  // Submit form (save as draft)
  const handleSubmit = () => {
    const createDto = buildCreateDto();
    if (!createDto) return;
    createMutation.mutate(createDto);
  };

  // Customer order that holds stock until confirmed (inventory-operations D7)
  const handleSubmitPending = () => {
    const createDto = buildCreateDto();
    if (!createDto) return;
    if (!createDto.customer_id) {
      toast.error('Đặt hàng giữ hàng cần chọn khách hàng');
      return;
    }
    createMutation.mutate({ ...createDto, status: 'pending' as CreateSalesOrderDto['status'] });
  };

  // Submit form with payment
  const handleSubmitWithPayment = () => {
    const createDto = buildCreateDto();
    if (!createDto) return;
    setIsCreatingWithPayment(true);
    createWithPaymentMutation.mutate(createDto);
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    if (createdOrder) {
      toast.success('Đã tạo đơn hàng và thanh toán thành công');
      navigate(`/sales/orders/${createdOrder.id}`);
    }
  };

  // Handle payment dialog close
  const handlePaymentDialogClose = (open: boolean) => {
    setIsPaymentDialogOpen(open);
    if (!open && createdOrder) {
      // If dialog closed without completing payment, still navigate to order
      navigate(`/sales/orders/${createdOrder.id}`);
    }
  };

  const isLoading = createMutation.isPending || isCreatingWithPayment;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Tạo đơn hàng bán lẻ
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Tạo đơn hàng mới cho khách hàng
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSubmit} disabled={isLoading}>
              {createMutation.isPending ? 'Đang lưu...' : 'Lưu nháp'}
            </Button>
            <Button variant="outline" onClick={handleSubmitPending} disabled={isLoading} title="Giữ hàng cho khách đến khi xác nhận">
              Đặt hàng (giữ hàng)
            </Button>
            <Button onClick={handleSubmitWithPayment} disabled={isLoading}>
              {isCreatingWithPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Thanh Toán
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Search and Items Table */}
        <div className="lg:col-span-2 space-y-4">
          <ProductSearchInput
            onProductSelect={handleAddProduct}
            placeholder="Tìm sản phẩm theo tên hoặc mã SKU..."
          />

          <PriceBookPicker storeId={selectedStoreId} customerId={selectedCustomerId || null} value={priceBookId} onChange={setPriceBookId} className="w-full sm:w-80" />

          <SalesOrderItemsTable
            items={items}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onUnit={(tempId, unit) => setItems(rawItems.map((it) => (it.tempId === tempId ? { ...it, unit_id: unit?.id ?? null } : it)))}
          />
        </div>

        {/* Right Side - Form Fields */}
        <div className="space-y-4">
          <CustomerSelectCard
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onCustomerChange={setSelectedCustomerId}
            customerName={customerName}
            customerPhone={customerPhone}
            isLoading={isLoadingCustomers}
          />

          {/* Loyalty Points Redemption */}
          {selectedCustomerId && subtotal > 0 && (
            <PointRedemptionInput
              customerId={selectedCustomerId}
              orderAmount={subtotal - calculatedDiscount}
              onRedemptionChange={handleRedemptionChange}
              disabled={isLoading}
            />
          )}

          <SalesOrderTotalsCard
            subtotal={subtotal}
            discountType={discountType}
            discountPercent={discountPercent}
            discountAmount={discountAmount}
            onDiscountTypeChange={setDiscountType}
            onDiscountPercentChange={setDiscountPercent}
            onDiscountAmountChange={setDiscountAmount}
            loyaltyDiscount={loyaltyDiscountAmount}
            loyaltyPointsUsed={pointsToRedeem}
          />

          <OrderPricingCard breakdown={breakdown.data} loading={breakdown.isFetching} error={breakdown.error} voucherCode={voucherCode} onVoucher={setVoucherCode} />

          <SalesOrderNotesCard
            notes={notes}
            onNotesChange={setNotes}
          />
        </div>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={handlePaymentDialogClose}
        order={createdOrder}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
