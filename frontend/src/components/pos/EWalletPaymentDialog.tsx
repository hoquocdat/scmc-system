import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EWalletPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirmPayment: (provider: string, transactionId: string) => void;
}

type PaymentProvider = 'momo' | 'zalopay' | 'vnpay';
type PaymentStatus = 'idle' | 'generating' | 'waiting' | 'success' | 'error' | 'timeout';

export function EWalletPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirmPayment,
}: EWalletPaymentDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('momo');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(300); // 5 minutes
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Countdown timer
  useEffect(() => {
    if (paymentStatus === 'waiting' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (paymentStatus === 'waiting' && countdown === 0) {
      setPaymentStatus('timeout');
    }
  }, [paymentStatus, countdown]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPaymentStatus('idle');
      setQrCodeUrl('');
      setCountdown(300);
      setErrorMessage('');
    }
  }, [open]);

  // Generate QR code
  const handleGenerateQR = async () => {
    setPaymentStatus('generating');
    setErrorMessage('');

    try {
      // TODO: Replace with actual API call to generate QR code
      // const response = await paymentsApi.generateQR(selectedProvider, totalAmount);
      // setQrCodeUrl(response.qrCodeUrl);

      // Simulate QR generation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate a placeholder QR code (using a QR code generator service)
      const qrData = `${selectedProvider.toUpperCase()}:${totalAmount}:${Date.now()}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

      setQrCodeUrl(qrUrl);
      setPaymentStatus('waiting');
      setCountdown(300); // Reset countdown

      // Start polling for payment status
      startPaymentPolling();
    } catch (error) {
      setPaymentStatus('error');
      setErrorMessage('Không thể tạo mã QR. Vui lòng thử lại.');
    }
  };

  // Poll for payment status
  const startPaymentPolling = () => {
    // TODO: Implement actual payment status polling
    // This would poll the backend every 2-3 seconds to check if payment is confirmed

    // Simulate payment success after 10 seconds (for demo)
    setTimeout(() => {
      if (paymentStatus === 'waiting') {
        const transactionId = `${selectedProvider.toUpperCase()}-${Date.now()}`;
        setPaymentStatus('success');

        // Wait a moment to show success state
        setTimeout(() => {
          onConfirmPayment(selectedProvider, transactionId);
          handleClose();
        }, 2000);
      }
    }, 10000);
  };

  const handleClose = () => {
    setPaymentStatus('idle');
    setQrCodeUrl('');
    setCountdown(300);
    setErrorMessage('');
    onOpenChange(false);
  };

  const handleRetry = () => {
    handleGenerateQR();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isGenerating = paymentStatus === 'generating';
  const isWaiting = paymentStatus === 'waiting';
  const isSuccess = paymentStatus === 'success';
  const isError = paymentStatus === 'error';
  const isTimeout = paymentStatus === 'timeout';

  const providerNames = {
    momo: 'MoMo',
    zalopay: 'ZaloPay',
    vnpay: 'VNPay',
  };

  const providerColors = {
    momo: 'bg-pink-100 text-pink-700',
    zalopay: 'bg-blue-100 text-blue-700',
    vnpay: 'bg-red-100 text-red-700',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán Ví điện tử</DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          // Success State
          <div className="py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thanh toán thành công!</h3>
            <p className="text-muted-foreground">
              Đã nhận thanh toán qua {providerNames[selectedProvider]}
            </p>
          </div>
        ) : isError || isTimeout ? (
          // Error/Timeout State
          <div className="py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {isTimeout ? 'Hết thời gian chờ' : 'Thanh toán thất bại'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {isTimeout
                ? 'Mã QR đã hết hạn. Vui lòng thử lại.'
                : errorMessage || 'Có lỗi xảy ra. Vui lòng thử lại.'}
            </p>
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total Amount */}
            <div className="bg-muted rounded-lg p-4">
              <Label className="text-sm text-muted-foreground">Tổng tiền</Label>
              <div className="text-3xl font-bold text-primary mt-1">
                {formatCurrency(totalAmount)}
              </div>
            </div>

            {/* Provider Selection */}
            {!isWaiting && !isGenerating && (
              <Tabs value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as PaymentProvider)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="momo">MoMo</TabsTrigger>
                  <TabsTrigger value="zalopay">ZaloPay</TabsTrigger>
                  <TabsTrigger value="vnpay">VNPay</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* QR Code Display */}
            {isWaiting && qrCodeUrl && (
              <div className="space-y-4">
                <div className={`rounded-lg p-3 text-center ${providerColors[selectedProvider]}`}>
                  <p className="font-semibold">
                    Quét mã QR bằng ứng dụng {providerNames[selectedProvider]}
                  </p>
                </div>

                <div className="bg-white border-4 border-muted rounded-lg p-4 flex items-center justify-center">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      Đang chờ thanh toán...
                    </span>
                  </div>
                  <p className="text-lg font-mono font-bold text-primary">
                    {formatTime(countdown)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mã QR sẽ hết hạn sau {formatTime(countdown)}
                  </p>
                </div>
              </div>
            )}

            {/* Generating State */}
            {isGenerating && (
              <div className="py-8 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Đang tạo mã QR...</p>
              </div>
            )}

            {/* Instructions */}
            {!isWaiting && !isGenerating && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2 text-blue-900">
                  Hướng dẫn thanh toán
                </h4>
                <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Chọn ví điện tử muốn sử dụng</li>
                  <li>Nhấn "Tạo mã QR"</li>
                  <li>Mở ứng dụng ví điện tử trên điện thoại</li>
                  <li>Quét mã QR hiển thị trên màn hình</li>
                  <li>Xác nhận thanh toán trên ứng dụng</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {!isSuccess && !isError && !isTimeout && (
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
              className="flex-1"
            >
              Hủy
            </Button>
            {!isWaiting && (
              <Button
                onClick={handleGenerateQR}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  'Tạo mã QR'
                )}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
