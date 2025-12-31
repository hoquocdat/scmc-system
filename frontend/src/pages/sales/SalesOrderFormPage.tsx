import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  salesApi,
  type CreateSalesOrderDto,
  type SalesChannel,
  type DiscountType,
} from '@/lib/api/sales';
import { customersApi } from '@/lib/api/customers';
import { ProductSearchInput } from '@/components/inventory/purchase-orders/ProductSearchInput';
import {
  SalesOrderItemsTable,
  CustomerSelectCard,
  SalesOrderTotalsCard,
  SalesOrderNotesCard,
  type SalesOrderItem,
} from '@/components/sales-orders/form';

export function SalesOrderFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel>('retail_store');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Fetch customers
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  const customers = customersData?.data || [];

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

  // Update item unit price
  const handleUpdateUnitPrice = (tempId: string, unit_price: number) => {
    if (unit_price < 0) return;
    setItems(
      items.map((item) => (item.tempId === tempId ? { ...item, unit_price } : item))
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

  // Submit form
  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm');
      return;
    }

    const createDto: CreateSalesOrderDto = {
      customer_id: selectedCustomerId || undefined,
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      customer_email: customerEmail || undefined,
      channel: selectedChannel,
      discount_type: discountType,
      discount_percent: discountType === 'percent' ? discountPercent : undefined,
      discount_amount: calculatedDiscount,
      notes: notes || undefined,
      items: items.map(({ tempId, product_name, product_sku, variant_name, ...item }) => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
      })),
    };

    createMutation.mutate(createDto);
  };

  const isLoading = createMutation.isPending;

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
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Đang lưu...' : 'Lưu đơn hàng'}
          </Button>
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

          <SalesOrderItemsTable
            items={items}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateUnitPrice={handleUpdateUnitPrice}
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
            customerEmail={customerEmail}
            onCustomerNameChange={setCustomerName}
            onCustomerPhoneChange={setCustomerPhone}
            onCustomerEmailChange={setCustomerEmail}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            isLoading={isLoadingCustomers}
          />

          <SalesOrderTotalsCard
            subtotal={subtotal}
            discountType={discountType}
            discountPercent={discountPercent}
            discountAmount={discountAmount}
            onDiscountTypeChange={setDiscountType}
            onDiscountPercentChange={setDiscountPercent}
            onDiscountAmountChange={setDiscountAmount}
          />

          <SalesOrderNotesCard
            notes={notes}
            onNotesChange={setNotes}
          />
        </div>
      </div>
    </div>
  );
}
