import { useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PosReceipt } from '@/lib/api/pos';
import { printElement } from '@/lib/utils/print';
import { ReceiptTemplate, type ReceiptPaper } from './ReceiptTemplate';

const PAPER_KEY = 'pos:paper';

function readPaper(): ReceiptPaper {
  try {
    return (localStorage.getItem(PAPER_KEY) as ReceiptPaper) || '80mm';
  } catch {
    return '80mm';
  }
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: PosReceipt | null;
  onNewSale?: () => void;
}

/** Shows the receipt returned by the server, prints it (80 mm by default, A4 as a setting). */
export function ReceiptDialog({ open, onOpenChange, receipt, onNewSale }: ReceiptDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [paper, setPaper] = useState<ReceiptPaper>(readPaper);

  const changePaper = (p: ReceiptPaper) => {
    setPaper(p);
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      // ignore
    }
  };

  const print = async () => {
    if (!ref.current) return;
    try {
      await printElement(ref.current, { title: receipt?.order_number, paperSize: paper });
    } catch {
      toast.error('Không mở được hộp thoại in');
    }
  };

  if (!receipt) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{receipt.reprint ? 'In lại hóa đơn' : 'Hóa đơn'} {receipt.order_number}</DialogTitle>
          <DialogDescription>{receipt.idempotent_replay ? 'Giao dịch này đã được ghi nhận trước đó.' : receipt.reprint ? 'Bản in lại được ghi vào nhật ký.' : 'Đã ghi nhận bán hàng.'}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Tabs value={paper} onValueChange={(v) => changePaper(v as ReceiptPaper)}>
            <TabsList>
              <TabsTrigger value="80mm">Khổ 80mm</TabsTrigger>
              <TabsTrigger value="A4">Khổ A4</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => void print()}><Printer className="h-4 w-4" /> In</Button>
        </div>
        <ScrollArea className="max-h-[60vh] rounded-md border bg-muted/40 p-3">
          <ReceiptTemplate ref={ref} receipt={receipt} paper={paper} />
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          {onNewSale && <Button onClick={() => { onNewSale(); onOpenChange(false); }}>Đơn mới</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
