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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  supplierPaymentsApi,
  type CreateSupplierPaymentDto,
  type SupplierPaymentMethod,
  type PaymentAllocationDto,
} from '@/lib/api/supplier-payments';
import { suppliersApi } from '@/lib/api/suppliers';
import { toast } from 'sonner';

interface RecordSupplierPaymentDialogProps {
  supplierId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  amount: number;
  payment_method: SupplierPaymentMethod;
  payment_date: string;
  transaction_id: string;
  reference_number: string;
  notes: string;
}

const PAYMENT_METHODS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'card', label: 'Thẻ' },
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
  { value: 'ewallet_momo', label: 'Ví MoMo' },
  { value: 'ewallet_zalopay', label: 'Ví ZaloPay' },
  { value: 'ewallet_vnpay', label: 'Ví VNPay' },
];

export function RecordSupplierPaymentDialog({
  supplierId,
  open,
  onOpenChange,
  onSuccess,
}: RecordSupplierPaymentDialogProps) {
  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual'>('auto');
  const [selectedPOs, setSelectedPOs] = useState<{ [key: string]: number }>({});
  const queryClient = useQueryClient();

  // _errors reserved for future form validation display
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors: _errors },
  } = useForm<FormData>({
    defaultValues: {
      amount: 0,
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      transaction_id: '',
      reference_number: '',
      notes: '',
    },
  });

  const _paymentAmount = watch('amount');
  void _paymentAmount; // Reserved for future validation
  const selectedMethod = watch('payment_method');

  // Fetch outstanding purchase orders
  const { data: outstandingPOs } = useQuery({
    queryKey: ['outstandingPOs', supplierId],
    queryFn: () => suppliersApi.getOutstandingPurchaseOrders(supplierId),
    enabled: !!supplierId && open,
  });

  // Fetch accounts payable
  const { data: accountsPayable } = useQuery({
    queryKey: ['accountsPayable', supplierId],
    queryFn: () => suppliersApi.getAccountsPayable(supplierId),
    enabled: !!supplierId && open,
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: (data: CreateSupplierPaymentDto) => supplierPaymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierDetails', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['supplierTransactions', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['outstandingPOs', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['accountsPayable', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      reset();
      setSelectedPOs({});
      setAllocationMode('auto');
      onSuccess();
      onOpenChange(false);
      toast.success('Đã ghi nhận thanh toán thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi ghi nhận thanh toán');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!data.payment_method) {
      toast.error('Vui lòng chọn phương thức thanh toán');
      return;
    }

    if (data.amount <= 0) {
      toast.error('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    const balanceDue = accountsPayable?.balance_due || 0;
    if (data.amount > balanceDue) {
      toast.error(`Số tiền thanh toán vượt quá công nợ (${formatCurrency(balanceDue)})`);
      return;
    }

    let allocations: PaymentAllocationDto[] | undefined;

    if (allocationMode === 'manual') {
      allocations = Object.entries(selectedPOs)
        .filter(([_, amount]) => amount > 0)
        .map(([poId, amount]) => ({
          purchase_order_id: poId,
          amount_allocated: amount,
        }));

      const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount_allocated, 0);
      if (totalAllocated > data.amount) {
        toast.error('Tổng số tiền phân bổ vượt quá số tiền thanh toán');
        return;
      }
    }

    const createDto: CreateSupplierPaymentDto = {
      supplier_id: supplierId,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: data.payment_date || undefined,
      transaction_id: data.transaction_id || undefined,
      reference_number: data.reference_number || undefined,
      notes: data.notes || undefined,
      allocations: allocationMode === 'manual' ? allocations : undefined,
    };

    createPaymentMutation.mutate(createDto);
  };

  const handleClose = () => {
    reset();
    setSelectedPOs({});
    setAllocationMode('auto');
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const totalManualAllocation = Object.values(selectedPOs).reduce((sum, amount) => sum + amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Outstanding Balance */}
          <div className="rounded-md bg-muted p-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Công nợ hiện tại:</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(accountsPayable?.balance_due || 0)}
              </span>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Số tiền thanh toán (VND) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              {...register('amount', {
                required: 'Vui lòng nhập số tiền',
                valueAsNumber: true,
                min: { value: 0.01, message: 'Số tiền phải lớn hơn 0' },
              })}
            />
            {_errors.amount && <p className="text-sm text-red-500">{_errors.amount.message}</p>}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">
              Phương thức thanh toán <span className="text-red-500">*</span>
            </Label>
            <Select value={selectedMethod} onValueChange={(value) => setValue('payment_method', value as SupplierPaymentMethod)}>
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Chọn phương thức" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="payment_date">Ngày thanh toán</Label>
            <Input id="payment_date" type="date" {...register('payment_date')} />
          </div>

          {/* Transaction ID & Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transaction_id">Mã giao dịch</Label>
              <Input
                id="transaction_id"
                placeholder="VD: TXN123456"
                {...register('transaction_id')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference_number">Số tham chiếu</Label>
              <Input
                id="reference_number"
                placeholder="VD: REF123456"
                {...register('reference_number')}
              />
            </div>
          </div>

          {/* Allocation Mode */}
          <div className="space-y-2">
            <Label>Phương thức phân bổ</Label>
            <RadioGroup value={allocationMode} onValueChange={(value) => setAllocationMode(value as 'auto' | 'manual')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="font-normal">
                  Tự động (ưu tiên đơn hàng cũ nhất)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="font-normal">
                  Thủ công (chọn đơn hàng cụ thể)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Manual Allocation */}
          {allocationMode === 'manual' && (
            <div className="space-y-2">
              <Label>Phân bổ cho các đơn hàng</Label>
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-4">
                {outstandingPOs && outstandingPOs.length > 0 ? (
                  outstandingPOs.map((po) => (
                    <div key={po.id} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!selectedPOs[po.id]}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPOs({ ...selectedPOs, [po.id]: 0 });
                              } else {
                                const newSelectedPOs = { ...selectedPOs };
                                delete newSelectedPOs[po.id];
                                setSelectedPOs(newSelectedPOs);
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium">{po.order_number}</p>
                            <p className="text-sm text-muted-foreground">
                              Còn nợ: {formatCurrency(Number(po.balance_due))}
                            </p>
                          </div>
                        </div>
                      </div>
                      {selectedPOs[po.id] !== undefined && (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={Number(po.balance_due)}
                          placeholder="Nhập số tiền phân bổ"
                          value={selectedPOs[po.id] || 0}
                          onChange={(e) =>
                            setSelectedPOs({
                              ...selectedPOs,
                              [po.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Không có đơn hàng chưa thanh toán
                  </p>
                )}
              </div>
              {allocationMode === 'manual' && (
                <div className="flex justify-between text-sm">
                  <span>Tổng phân bổ:</span>
                  <span className="font-medium">{formatCurrency(totalManualAllocation)}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              placeholder="Ghi chú cho thanh toán..."
              {...register('notes')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={createPaymentMutation.isPending}>
              {createPaymentMutation.isPending ? 'Đang ghi nhận...' : 'Ghi nhận thanh toán'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
