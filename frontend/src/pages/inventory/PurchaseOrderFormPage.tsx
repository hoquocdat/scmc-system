import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { purchaseOrdersApi, type CreatePurchaseOrderDto, type CreatePurchaseOrderItemDto } from '@/lib/api/purchase-orders';
import { suppliersApi } from '@/lib/api/suppliers';
import { productsApi } from '@/lib/api/products';

interface PurchaseOrderItem extends CreatePurchaseOrderItemDto {
  tempId: string;
}

export function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
        tempId: item.id, // Use actual ID for existing items
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
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getAll,
  });

  // Fetch products for selection
  const { data: productsResponse } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: () => productsApi.getAll({ search: searchQuery }),
    enabled: searchQuery.length > 0,
  });
  const products = productsResponse?.data || [];

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setSearchQuery('');
    setShowSearchResults(false);
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
      // For edit mode, we update the PO
      const updateDto = {
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        // Note: For now we're only updating notes. Item management requires separate API calls.
      };
      updateMutation.mutate(updateDto);
    } else {
      // For create mode
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
          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Đang lưu...' : 'Lưu đơn hàng'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Search and Items Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Search */}
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Tìm theo mã hàng (F3)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="pl-9"
            />

            {/* Search Results Dropdown */}
            {showSearchResults && searchQuery && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-background border rounded-md shadow-lg">
                {products.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Không tìm thấy sản phẩm
                  </div>
                ) : (
                  <div className="divide-y">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="p-3 hover:bg-accent cursor-pointer"
                        onClick={() => handleAddProduct(product)}
                      >
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {product.sku} | {Number(product.cost_price || 0).toLocaleString('vi-VN')} VND
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <Card className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>Mã hàng</TableHead>
                  <TableHead>Tên hàng</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Giảm giá</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const total = item.quantity_ordered * item.unit_cost;
                    return (
                      <TableRow key={item.tempId}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.product_sku || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <div>{item.product_name}</div>
                            {item.variant_name && (
                              <div className="text-sm text-muted-foreground">
                                {item.variant_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={item.quantity_ordered}
                            onChange={(e) =>
                              handleUpdateQuantity(item.tempId, parseInt(e.target.value) || 1)
                            }
                            className="w-20 text-right"
                            min="1"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) =>
                              handleUpdateUnitCost(item.tempId, parseFloat(e.target.value) || 0)
                            }
                            className="w-28 text-right"
                            min="0"
                          />
                        </TableCell>
                        <TableCell className="text-right">0</TableCell>
                        <TableCell className="text-right font-medium">
                          {total.toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.tempId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Right Side - Form Fields */}
        <div className="space-y-4">
          {/* Supplier Selection */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nhà cung cấp *</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhà cung cấp" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers && suppliers.length > 0 ? (
                      suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Không có nhà cung cấp
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Input value="Phiếu tạm" disabled />
              </div>
            </div>
          </Card>

          {/* Totals */}
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Tổng tiền hàng</Label>
                <div className="font-semibold">{subtotal.toLocaleString('vi-VN')}</div>
              </div>

              <div className="flex justify-between items-center">
                <Label className="text-sm">Giảm giá</Label>
                <Input type="number" value="0" className="w-32 text-right" disabled />
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <Label className="font-semibold">Cần trả nhà cung cấp</Label>
                <div className="text-lg font-bold text-primary">
                  {subtotal.toLocaleString('vi-VN')}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Label className="text-sm">Tiền trả nhà cung cấp (F8)</Label>
                <Input type="number" value="0" className="w-32 text-right" disabled />
              </div>

              <div className="flex justify-between items-center">
                <Label className="text-sm">Tiền mặt</Label>
                <Input type="number" value="0" className="w-32 text-right" disabled />
              </div>

              <div className="flex justify-between items-center">
                <Label className="text-sm">Tính vào công nợ</Label>
                <div className="font-semibold text-destructive">
                  -{subtotal.toLocaleString('vi-VN')}
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea
                  placeholder="Ghi chú cho đơn hàng..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Ghi chú nội bộ</Label>
                <Textarea
                  placeholder="Ghi chú nội bộ (không hiển thị cho nhà cung cấp)..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
