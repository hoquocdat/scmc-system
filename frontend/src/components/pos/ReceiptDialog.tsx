import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Mail, MessageSquare, X } from 'lucide-react';
import { ReceiptTemplate, type ReceiptData } from './ReceiptTemplate';
import { printElement, downloadAsPDF } from '@/lib/utils/print';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: ReceiptData;
  onNewSale?: () => void;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  receiptData,
  onNewSale,
}: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Handle print
  const handlePrint = async () => {
    if (!receiptRef.current) return;

    try {
      await printElement(receiptRef.current, {
        title: `Receipt ${receiptData.receiptNumber}`,
        paperSize: '80mm',
        margins: '0',
      });
      toast.success('Đã gửi lệnh in');
    } catch (error) {
      console.error('Print failed:', error);
      toast.error('Không thể in hóa đơn');
    }
  };

  // Handle download as PDF
  const handleDownload = () => {
    if (!receiptRef.current) return;

    try {
      downloadAsPDF(
        receiptRef.current,
        `receipt-${receiptData.receiptNumber}.pdf`,
        {
          title: `Receipt ${receiptData.receiptNumber}`,
          paperSize: '80mm',
        }
      );
      toast.success('Đang tải xuống...');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Không thể tải xuống');
    }
  };

  // Handle email
  const handleEmail = () => {
    if (!receiptData.customer?.email) {
      toast.error('Khách hàng chưa có email');
      return;
    }

    // TODO: Implement email sending
    toast.info('Tính năng gửi email đang được phát triển');
  };

  // Handle SMS
  const handleSMS = () => {
    if (!receiptData.customer?.phone) {
      toast.error('Khách hàng chưa có số điện thoại');
      return;
    }

    // TODO: Implement SMS sending
    toast.info('Tính năng gửi SMS đang được phát triển');
  };

  // Handle new sale
  const handleNewSale = () => {
    onOpenChange(false);
    onNewSale?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hóa đơn thanh toán</DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <ReceiptTemplate ref={receiptRef} data={receiptData} />
        </div>

        {/* Action Buttons */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {/* Print Button */}
            <Button
              onClick={handlePrint}
              variant="default"
              className="flex-1"
            >
              <Printer className="mr-2 h-4 w-4" />
              In hóa đơn
            </Button>

            {/* Download Button */}
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Tải xuống
            </Button>
          </div>

          <div className="flex gap-2 flex-1">
            {/* Email Button */}
            <Button
              onClick={handleEmail}
              variant="outline"
              disabled={!receiptData.customer?.email}
              className="flex-1"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>

            {/* SMS Button */}
            <Button
              onClick={handleSMS}
              variant="outline"
              disabled={!receiptData.customer?.phone}
              className="flex-1"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              SMS
            </Button>
          </div>
        </DialogFooter>

        {/* Bottom Actions */}
        <div className="border-t pt-4 flex gap-2">
          <Button
            onClick={handleNewSale}
            variant="default"
            size="lg"
            className="flex-1"
          >
            Đơn hàng mới
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            size="lg"
          >
            <X className="mr-2 h-4 w-4" />
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
