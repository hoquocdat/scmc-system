import { useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CardPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirmPayment: (transactionId: string, last4Digits: string) => void;
}

type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

export function CardPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirmPayment,
}: CardPaymentDialogProps) {
  const [cardNumber, setCardNumber] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Format card number with spaces (XXXX XXXX XXXX XXXX)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '');
    if (value.length <= 16 && /^\d*$/.test(value)) {
      setCardNumber(formatCardNumber(value));
    }
  };

  // Handle payment processing
  const handleProcessPayment = async () => {
    const cleanedCardNumber = cardNumber.replace(/\s/g, '');

    // Validation
    if (cleanedCardNumber.length < 13) {
      setErrorMessage('Số thẻ không hợp lệ');
      return;
    }

    if (!authCode.trim()) {
      setErrorMessage('Vui lòng nhập mã xác thực');
      return;
    }

    setPaymentStatus('processing');
    setErrorMessage('');

    try {
      // TODO: Integrate with actual card terminal API
      // Simulate card processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate success
      const transactionId = `TXN${Date.now()}`;
      const last4 = cleanedCardNumber.slice(-4);

      setPaymentStatus('success');

      // Wait a moment to show success state
      setTimeout(() => {
        onConfirmPayment(transactionId, last4);
        handleClose();
      }, 1500);
    } catch (error) {
      setPaymentStatus('error');
      setErrorMessage('Giao dịch thất bại. Vui lòng thử lại.');
    }
  };

  const handleClose = () => {
    setCardNumber('');
    setAuthCode('');
    setPaymentStatus('idle');
    setErrorMessage('');
    onOpenChange(false);
  };

  const isProcessing = paymentStatus === 'processing';
  const isSuccess = paymentStatus === 'success';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Thanh toán thẻ
          </DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          // Success State
          <div className="py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thanh toán thành công!</h3>
            <p className="text-muted-foreground">
              Giao dịch đã được xử lý thành công
            </p>
          </div>
        ) : (
          // Payment Form
          <div className="space-y-6">
            {/* Total Amount */}
            <div className="bg-muted rounded-lg p-4">
              <Label className="text-sm text-muted-foreground">Tổng tiền</Label>
              <div className="text-3xl font-bold text-primary mt-1">
                {formatCurrency(totalAmount)}
              </div>
            </div>

            {/* Card Number Input */}
            <div className="space-y-2">
              <Label htmlFor="card-number">Số thẻ</Label>
              <Input
                id="card-number"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={handleCardNumberChange}
                disabled={isProcessing}
                className="h-14 text-lg"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Nhập 13-16 số thẻ từ máy quẹt thẻ
              </p>
            </div>

            <Separator />

            {/* Authorization Code */}
            <div className="space-y-2">
              <Label htmlFor="auth-code">Mã xác thực (Authorization Code)</Label>
              <Input
                id="auth-code"
                placeholder="Nhập mã xác thực..."
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                disabled={isProcessing}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Mã xác thực từ máy quẹt thẻ hoặc ngân hàng
              </p>
            </div>

            {/* Payment Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 text-blue-900">
                Hướng dẫn thanh toán
              </h4>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>Quẹt thẻ qua máy POS</li>
                <li>Nhập số thẻ hiển thị trên máy</li>
                <li>Nhập mã xác thực từ máy POS</li>
                <li>Nhấn "Xử lý thanh toán"</li>
              </ol>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {!isSuccess && (
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button
              onClick={handleProcessPayment}
              disabled={isProcessing || !cardNumber || !authCode}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Xử lý thanh toán'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
