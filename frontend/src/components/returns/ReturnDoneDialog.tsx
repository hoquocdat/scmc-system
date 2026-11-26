import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SalesReturn } from '@/lib/api/sales-returns';
import { printElement } from '@/lib/utils/print';
import { ReturnReceipt } from './ReturnReceipt';

interface Props {
  ret: SalesReturn | null;
  onOpenChange: (open: boolean) => void;
}

/** Shown after a return is posted: the slip with print, and a link to the exchange order. */
export function ReturnDoneDialog({ ret, onOpenChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!ret) return null;
  const exchange = ret.sales_orders_sales_returns_exchange_order_idTosales_orders;
  const print = () =>
    ref.current && printElement(ref.current, { title: ret.return_number, paperSize: '80mm' }).catch((e: Error) => toast.error(e.message));
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đã ghi nhận {ret.return_number}</DialogTitle>
          <DialogDescription>Kho, sổ quỹ, công nợ và điểm thưởng đã được cập nhật.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] rounded-md border">
          <ReturnReceipt ref={ref} ret={ret} />
        </ScrollArea>
        <DialogFooter className="gap-2">
          {exchange && <Button asChild variant="outline"><Link to={`/sales/orders/${exchange.id}`}>Xem đơn đổi {exchange.order_number}</Link></Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={() => void print()}><Printer className="h-4 w-4" /> In phiếu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
