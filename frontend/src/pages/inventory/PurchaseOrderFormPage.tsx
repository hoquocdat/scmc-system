import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { purchaseOrdersApi, type CreatePurchaseOrderDto } from '@/lib/api/purchase-orders';
import { suppliersApi } from '@/lib/api/suppliers';
import {
  ProductSearchInput,
  PurchaseOrderItemsTable,
  SupplierSelectCard,
  OrderTotalsCard,
  OrderNotesCard,
  type PurchaseOrderItem,
} from '@/components/inventory/purchase-orders';

export function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Fetch existing purchase order if in edit mode
  const { data: existingPO, isLoading: isLoadingPO } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => purchaseOrdersApi.getById(id!),
    enabled: isEditMode,
  });

  // Load existing data when editing
  useEffect(() => {
    if (existingPO) {
      setSelectedSupplierId(existingPO.supplier_id);
      setNotes(existingPO.notes || '');
      setInternalNotes(existingPO.internal_notes || '');

      // Convert existing items to the form format
      const existingItems: PurchaseOrderItem[] = existingPO.purchase_order_items?.map((item: any) => ({
        tempId: item.id,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        variant_name: item.variant_name,
        quantity_ordered: item.quantity_ordered,
        unit_cost: Number(item.unit_cost),
        notes: item.notes,
      })) || [];

      setItems(existingItems);
    }
  }, [existingPO]);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getAll,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (dto: CreatePurchaseOrderDto) => purchaseOrdersApi.create(dto),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success('Đã tạo đơn đặt hàng thành công');
      navigate(`/inventory/purchase-orders/${response.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn đặt hàng');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (dto: any) => purchaseOrdersApi.update(id!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
      toast.success('Đã cập nhật đơn đặt hàng thành công');
      navigate(`/inventory/purchase-orders/${id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật đơn đặt hàng');
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
            ? { ...item, quantity_ordered: item.quantity_ordered + 1 }
            : item
        )
      );
    } else {
      const newItem: PurchaseOrderItem = {
        tempId: Math.random().toString(36).substr(2, 9),
        product_id: product.id,
        product_variant_id: variant?.id,
        product_name: product.name,
        product_sku: product.sku || undefined,
        variant_name: variant?.name,
        quantity_ordered: 1,
        unit_cost: Number(product.cost_price || 0),
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
        item.tempId === tempId ? { ...item, quantity_ordered: quantity } : item
      )
    );
  };

  // Update item unit cost
  const handleUpdateUnitCost = (tempId: string, cost: number) => {
    if (cost < 0) return;
    setItems(
      items.map((item) => (item.tempId === tempId ? { ...item, unit_cost: cost } : item))
    );
  };

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity_ordered * item.unit_cost,
    0
  );

  // Submit form
  const handleSubmit = () => {
    if (!selectedSupplierId) {
      toast.error('Vui lòng chọn nhà cung cấp');
      return;
    }

    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm');
      return;
    }

    if (isEditMode) {
      const updateDto = {
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
      };
      updateMutation.mutate(updateDto);
    } else {
      const createDto: CreatePurchaseOrderDto = {
        supplier_id: selectedSupplierId,
        tax_amount: 0,
        shipping_cost: 0,
        discount_amount: 0,
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        items: items.map(({ tempId, ...item }) => item),
      };
      createMutation.mutate(createDto);
    }
  };

  if (isLoadingPO) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Đang tải...</div>
        </div>
      </div>
    );
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/purchase-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {isEditMode ? 'Chỉnh sửa đơn đặt hàng' : 'Tạo đơn đặt hàng'}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {isEditMode ? 'Cập nhật thông tin đơn đặt hàng' : 'Tạo đơn đặt hàng mới từ nhà cung cấp'}
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
          <ProductSearchInput onProductSelect={handleAddProduct} />

          <PurchaseOrderItemsTable
            items={items}
            onRemoveItem={handleRemoveItem}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateUnitCost={handleUpdateUnitCost}
          />
        </div>

        {/* Right Side - Form Fields */}
        <div className="space-y-4">
          <SupplierSelectCard
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            onSupplierChange={setSelectedSupplierId}
          />

          <OrderTotalsCard subtotal={subtotal} />

          <OrderNotesCard
            notes={notes}
            internalNotes={internalNotes}
            onNotesChange={setNotes}
            onInternalNotesChange={setInternalNotes}
          />
        </div>
      </div>
    </div>
  );
}
