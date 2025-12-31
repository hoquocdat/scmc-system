import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  supplierReturnsApi,
  type CreateSupplierReturnDto,
  type ReturnItemDto,
} from '@/lib/api/supplier-returns';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { toast } from 'sonner';

interface CreateSupplierReturnDialogProps {
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  purchase_order_id: string;
  return_date: string;
  reason: string;
  notes: string;
}

export function CreateSupplierReturnDialog({
  supplierId,
  open,
  onOpenChange,
  onSuccess,
}: CreateSupplierReturnDialogProps) {
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [returnItems, setReturnItems] = useState<{ [key: string]: { quantity: number; reason: string } }>({});
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      purchase_order_id: '',
      return_date: new Date().toISOString().split('T')[0],
      reason: '',
      notes: '',
    },
  });

  // Fetch approved purchase orders for this supplier
  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchaseOrders', { supplier_id: supplierId, status: 'approved' }],
    queryFn: () => purchaseOrdersApi.getAll({ supplier_id: supplierId, status: 'approved' }),
    enabled: !!supplierId && open,
  });

  // Fetch selected purchase order details
  const { data: selectedPO } = useQuery({
    queryKey: ['purchaseOrder', selectedPOId],
    queryFn: () => purchaseOrdersApi.getOne(selectedPOId),
    enabled: !!selectedPOId,
  });

  // Create return mutation
  const createReturnMutation = useMutation({
    mutationFn: (data: CreateSupplierReturnDto) => supplierReturnsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierDetails', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['supplierTransactions', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      reset();
      setSelectedPOId('');
      setReturnItems({});
      onSuccess();
      onOpenChange(false);
      toast.success('Đã tạo phiếu trả hàng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu trả hàng');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!selectedPOId) {
      toast.error('Vui lòng chọn đơn đặt hàng');
      return;
    }

    const items: ReturnItemDto[] = Object.entries(returnItems)
      .filter(([_, item]) => item.quantity > 0)
      .map(([itemId, item]) => ({
        purchase_order_item_id: itemId,
        quantity_returned: item.quantity,
        reason: item.reason || undefined,
      }));

    if (items.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sản phẩm để trả');
      return;
    }

    // Validate quantities
    for (const item of items) {
      const poItem = selectedPO?.purchase_order_items?.find((i) => i.id === item.purchase_order_item_id);
      if (poItem) {
        const maxReturnQty = poItem.quantity_received - poItem.quantity_returned;
        if (item.quantity_returned > maxReturnQty) {
          toast.error(`Số lượng trả vượt quá số lượng có thể trả (${maxReturnQty}) cho sản phẩm ${poItem.product_name}`);
          return;
        }
      }
    }

    const createDto: CreateSupplierReturnDto = {
      supplier_id: supplierId,
      purchase_order_id: selectedPOId,
      return_date: data.return_date || undefined,
      reason: data.reason || undefined,
      notes: data.notes || undefined,
      items,
    };

    createReturnMutation.mutate(createDto);
  };

  const handleClose = () => {
    reset();
    setSelectedPOId('');
    setReturnItems({});
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const totalReturnValue = Object.entries(returnItems).reduce((sum, [itemId, item]) => {
    const poItem = selectedPO?.purchase_order_items?.find((i) => i.id === itemId);
    if (poItem && item.quantity > 0) {
      return sum + Number(poItem.unit_cost) * item.quantity;
    }
    return sum;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Tạo phiếu trả hàng</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Purchase Order Selection */}
          <div className="space-y-2">
            <Label htmlFor="purchase_order">
              Đơn đặt hàng <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedPOId} onValueChange={setSelectedPOId}>
              <SelectTrigger id="purchase_order">
                <SelectValue placeholder="Chọn đơn đặt hàng đã duyệt" />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders && purchaseOrders.length > 0 ? (
                  purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.order_number} - {formatCurrency(Number(po.total_amount))}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Không có đơn đặt hàng nào
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Return Date */}
          <div className="space-y-2">
            <Label htmlFor="return_date">Ngày trả hàng</Label>
            <Input id="return_date" type="date" {...register('return_date')} />
          </div>

          {/* Items to Return */}
          {selectedPO && (
            <div className="space-y-2">
              <Label>Sản phẩm trả hàng</Label>
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border p-4">
                {selectedPO.purchase_order_items && selectedPO.purchase_order_items.length > 0 ? (
                  selectedPO.purchase_order_items.map((item) => {
                    const maxReturnQty = item.quantity_received - item.quantity_returned;
                    const isSelected = !!returnItems[item.id];

                    return (
                      <div key={item.id} className="space-y-2 rounded-md border p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={isSelected}
                              disabled={maxReturnQty === 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setReturnItems({ ...returnItems, [item.id]: { quantity: 0, reason: '' } });
                                } else {
                                  const newReturnItems = { ...returnItems };
                                  delete newReturnItems[item.id];
                                  setReturnItems(newReturnItems);
                                }
                              }}
                            />
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              {item.variant_name && (
                                <p className="text-sm text-muted-foreground">{item.variant_name}</p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                SKU: {item.product_sku || '-'}
                              </p>
                              <p className="text-sm">
                                Đã nhận: {item.quantity_received} | Đã trả: {item.quantity_returned} | Có thể trả: {maxReturnQty}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(Number(item.unit_cost))}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="space-y-2">
                            <div>
                              <Label htmlFor={`qty-${item.id}`} className="text-sm">
                                Số lượng trả <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`qty-${item.id}`}
                                type="number"
                                min="1"
                                max={maxReturnQty}
                                placeholder={`Tối đa ${maxReturnQty}`}
                                value={returnItems[item.id]?.quantity || 0}
                                onChange={(e) =>
                                  setReturnItems({
                                    ...returnItems,
                                    [item.id]: {
                                      ...returnItems[item.id],
                                      quantity: parseInt(e.target.value) || 0,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor={`reason-${item.id}`} className="text-sm">
                                Lý do trả
                              </Label>
                              <Input
                                id={`reason-${item.id}`}
                                placeholder="Lỗi sản xuất, hỏng hóc..."
                                value={returnItems[item.id]?.reason || ''}
                                onChange={(e) =>
                                  setReturnItems({
                                    ...returnItems,
                                    [item.id]: {
                                      ...returnItems[item.id],
                                      reason: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Đơn hàng không có sản phẩm nào
                  </p>
                )}
              </div>
              {Object.keys(returnItems).length > 0 && (
                <div className="rounded-md bg-muted p-3">
                  <div className="flex justify-between text-sm">
                    <span>Tổng giá trị trả:</span>
                    <span className="font-semibold">{formatCurrency(totalReturnValue)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Return Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Lý do trả hàng chung</Label>
            <Textarea
              id="reason"
              placeholder="Lý do trả hàng..."
              {...register('reason')}
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú thêm..."
              {...register('notes')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={createReturnMutation.isPending}>
              {createReturnMutation.isPending ? 'Đang tạo...' : 'Tạo phiếu trả hàng'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
