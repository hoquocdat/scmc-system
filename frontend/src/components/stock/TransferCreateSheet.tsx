import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { stockError, stockOpsApi, type Transfer } from '@/lib/api/stock-operations';
import { LocationSelect } from './LocationSelect';
import { StockLinesEditor, type EditorLine } from './StockLinesEditor';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (t: Transfer) => void;
}

/** New stock transfer: from, to, items; stock moves only when it is shipped. */
export function TransferCreateSheet({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) { setLines([]); setNotes(''); } }, [open]);
  const save = useMutation({
    mutationFn: () => stockOpsApi.createTransfer({ from_location_id: from!, to_location_id: to!, notes: notes || undefined, items: lines.map(({ product_id, product_variant_id, quantity }) => ({ product_id, product_variant_id, quantity })) }),
    onSuccess: (t) => { toast.success(`Đã tạo ${t.transfer_number}`); void queryClient.invalidateQueries({ queryKey: ['stock-transfers'] }); onOpenChange(false); onCreated(t); },
    onError: (e) => toast.error(stockError(e)),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>Tạo phiếu chuyển kho</SheetTitle>
          <SheetDescription>Tồn kho chỉ thay đổi khi phiếu được xuất (kho đi) và nhận (kho đến).</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Từ kho</Label><LocationSelect value={from} onChange={setFrom} exclude={to} /></div>
            <div className="space-y-2"><Label>Đến kho</Label><LocationSelect value={to} onChange={setTo} exclude={from} /></div>
          </div>
          <StockLinesEditor lines={lines} onChange={setLines} />
          <div className="space-y-2"><Label htmlFor="tr-notes">Ghi chú</Label><Textarea id="tr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!from || !to || !lines.length || save.isPending} onClick={() => save.mutate()}>Tạo phiếu</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
