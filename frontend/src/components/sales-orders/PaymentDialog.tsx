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
import {
  salesApi,
  type SalesOrder,
  type CreatePaymentDto,
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from '@/lib/api/sales';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrder | null;
  onSuccess?: () => void;
}

interface FormData {
  payment_method: PaymentMethod;
  amount: number;
  amount_tendered: number;
  transaction_id: string;
  notes: string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');

  const remainingAmount = order
    ? Number(order.total_amount) - Number(order.paid_amount || 0)
    : 0;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      payment_method: 'cash',
      amount: remainingAmount,
      amount_tendered: remainingAmount,
      transaction_id: '',
      notes: '',
    },
  });

  const amount = watch('amount');
  const amountTendered = watch('amount_tendered');
  const changeGiven = selectedMethod === 'cash' ? Math.max(0, amountTendered - amount) : 0;

  // Reset form when order changes
  useState(() => {
    if (order) {
      const remaining = Number(order.total_amount) - Number(order.paid_amount || 0);
      reset({
        payment_method: 'cash',
        amount: remaining,
        amount_tendered: remaining,
        transaction_id: '',
        notes: '',
      });
    }
  });

  const addPaymentMutation = useMutation({
    mutationFn: (data: CreatePaymentDto) => salesApi.addPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', order?.id] });
      handleClose();
      toast.success('Đã ghi nhận thanh toán thành công');
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi ghi nhận thanh toán');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!order) return;

    if (data.amount <= 0) {
      toast.error('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    if (data.amount > remainingAmount) {
      toast.error('Số tiền thanh toán không được vượt quá số tiền còn lại');
      return;
    }

    const paymentData: CreatePaymentDto = {
      sales_order_id: order.id,
      payment_method: selectedMethod,
      amount: data.amount,
      transaction_id: data.transaction_id || undefined,
      amount_tendered: selectedMethod === 'cash' ? data.amount_tendered : undefined,
      change_given: selectedMethod === 'cash' ? changeGiven : undefined,
      notes: data.notes || undefined,
    };

    addPaymentMutation.mutate(paymentData);
  };

  const handleClose = () => {
    reset();
    setSelectedMethod('cash');
    onOpenChange(false);
  };

  const handlePayFullAmount = () => {
    setValue('amount', remainingAmount);
    setValue('amount_tendered', remainingAmount);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán đơn hàng {order.order_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-md bg-muted p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng đơn hàng:</span>
              <span className="font-medium">{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Đã thanh toán:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(order.paid_amount || 0)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Còn lại:</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Phương thức thanh toán</Label>
            <Select
              value={selectedMethod}
              onValueChange={(v) => setSelectedMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn phương thức" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
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
                Thanh toán hết
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              step="1000"
              min="0"
              max={remainingAmount}
              {...register('amount', {
                required: 'Vui lòng nhập số tiền',
                valueAsNumber: true,
                min: { value: 1, message: 'Số tiền phải lớn hơn 0' },
                max: { value: remainingAmount, message: 'Số tiền vượt quá số tiền còn lại' },
              })}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Cash-specific fields */}
          {selectedMethod === 'cash' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount_tendered">Tiền khách đưa</Label>
                <Input
                  id="amount_tendered"
                  type="number"
                  step="1000"
                  min={amount}
                  {...register('amount_tendered', { valueAsNumber: true })}
                />
              </div>

              <div className="rounded-md bg-green-50 p-3">
                <div className="flex justify-between">
                  <span>Tiền thối:</span>
                  <span className="font-bold text-green-600">{formatCurrency(changeGiven)}</span>
                </div>
              </div>
            </>
          )}

          {/* Transaction ID for non-cash payments */}
          {selectedMethod !== 'cash' && (
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
            disabled={addPaymentMutation.isPending}
          >
            {addPaymentMutation.isPending ? (
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
