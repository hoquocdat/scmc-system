import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  customersApi,
  type ReceivablePaymentMethod,
  type CustomerReceivable,
  RECEIVABLE_PAYMENT_METHOD_LABELS,
} from '@/lib/api/customers';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface RecordReceivablePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  receivables: CustomerReceivable[];
  totalBalance: number;
  onSuccess?: () => void;
}

interface FormData {
  payment_type: 'specific' | 'on_account';
  sales_order_id: string;
  amount: number;
  payment_method: ReceivablePaymentMethod;
  transaction_id: string;
  notes: string;
}

export function RecordReceivablePaymentDialog({
  open,
  onOpenChange,
  customerId,
  receivables,
  totalBalance,
  onSuccess,
}: RecordReceivablePaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentType, setPaymentType] = useState<'specific' | 'on_account'>('on_account');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  const unpaidReceivables = receivables.filter(
    (r) => r.status === 'unpaid' || r.status === 'partial'
  );

  const selectedReceivable = unpaidReceivables.find(
    (r) => r.sales_order_id === selectedOrderId
  );

  const maxAmount =
    paymentType === 'specific' && selectedReceivable
      ? selectedReceivable.balance
      : totalBalance;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      payment_type: 'on_account',
      sales_order_id: '',
      amount: totalBalance,
      payment_method: 'cash',
      transaction_id: '',
      notes: '',
    },
  });

  const paymentMethod = watch('payment_method');

  const recordPaymentMutation = useMutation({
    mutationFn: (data: FormData) =>
      customersApi.recordReceivablePayment(customerId, {
        amount: data.amount,
        payment_method: data.payment_method,
        sales_order_id:
          paymentType === 'specific' ? selectedOrderId : undefined,
        transaction_id: data.transaction_id || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: ['customer-receivables', customerId],
      });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      handleClose();
      toast.success(response.message);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Có lỗi xảy ra khi ghi nhận thanh toán'
      );
    },
  });

  const onSubmit = (data: FormData) => {
    if (data.amount <= 0) {
      toast.error('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    if (data.amount > maxAmount) {
      toast.error('Số tiền thanh toán vượt quá công nợ');
      return;
    }

    if (paymentType === 'specific' && !selectedOrderId) {
      toast.error('Vui lòng chọn đơn hàng để thanh toán');
      return;
    }

    recordPaymentMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setPaymentType('on_account');
    setSelectedOrderId('');
    onOpenChange(false);
  };

  const handlePayFullAmount = () => {
    setValue('amount', maxAmount);
  };

  const handlePaymentTypeChange = (value: 'specific' | 'on_account') => {
    setPaymentType(value);
    if (value === 'on_account') {
      setSelectedOrderId('');
      setValue('amount', totalBalance);
    } else if (unpaidReceivables.length > 0) {
      const firstReceivable = unpaidReceivables[0];
      setSelectedOrderId(firstReceivable.sales_order_id);
      setValue('amount', firstReceivable.balance);
    }
  };

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    const receivable = unpaidReceivables.find(
      (r) => r.sales_order_id === orderId
    );
    if (receivable) {
      setValue('amount', receivable.balance);
    }
  };

  if (totalBalance <= 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ghi nhận thanh toán công nợ</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            Khách hàng không có công nợ cần thanh toán.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán công nợ</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Balance Summary */}
          <div className="rounded-md bg-muted p-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng công nợ:</span>
              <span className="font-bold text-red-600">
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </div>

          {/* Payment Type Selection */}
          <div className="space-y-3">
            <Label>Hình thức thanh toán</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(v) =>
                handlePaymentTypeChange(v as 'specific' | 'on_account')
              }
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="on_account" id="on_account" />
                <Label htmlFor="on_account" className="font-normal cursor-pointer">
                  Thanh toán chung (FIFO - áp dụng cho đơn cũ nhất trước)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specific" id="specific" />
                <Label htmlFor="specific" className="font-normal cursor-pointer">
                  Thanh toán cho đơn hàng cụ thể
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Order Selection (for specific payment) */}
          {paymentType === 'specific' && (
            <div className="space-y-2">
              <Label>Chọn đơn hàng</Label>
              <Select value={selectedOrderId} onValueChange={handleOrderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn đơn hàng..." />
                </SelectTrigger>
                <SelectContent>
                  {unpaidReceivables.map((r) => (
                    <SelectItem key={r.sales_order_id} value={r.sales_order_id}>
                      {r.sales_orders?.order_number} - Còn nợ:{' '}
                      {formatCurrency(r.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Phương thức thanh toán</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) =>
                setValue('payment_method', v as ReceivablePaymentMethod)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn phương thức" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECEIVABLE_PAYMENT_METHOD_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Số tiền thanh toán</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={handlePayFullAmount}
              >
                Thanh toán hết ({formatCurrency(maxAmount)})
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              step="1000"
              min="0"
              max={maxAmount}
              {...register('amount', {
                required: 'Vui lòng nhập số tiền',
                valueAsNumber: true,
                min: { value: 1, message: 'Số tiền phải lớn hơn 0' },
                max: {
                  value: maxAmount,
                  message: 'Số tiền vượt quá công nợ',
                },
              })}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Transaction ID (for non-cash) */}
          {paymentMethod !== 'cash' && (
            <div className="space-y-2">
              <Label htmlFor="transaction_id">Mã giao dịch</Label>
              <Input
                id="transaction_id"
                {...register('transaction_id')}
                placeholder="Mã giao dịch từ ngân hàng/ví điện tử"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Ghi chú thanh toán..."
              rows={2}
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={recordPaymentMutation.isPending}
          >
            {recordPaymentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              'Xác nhận thanh toán'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
