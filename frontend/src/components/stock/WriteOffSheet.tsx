import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { stockError, stockOpsApi, WRITE_OFF_REASON_LABELS } from '@/lib/api/stock-operations';
import { LocationSelect } from './LocationSelect';
import { StockLinesEditor, type EditorLine } from './StockLinesEditor';

/** Xuất hủy: removes damaged, lost or used stock at its cost, with a reason. */
export function WriteOffSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<string>();
  const [reason, setReason] = useState('damaged');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditorLine[]>([]);
  useEffect(() => { if (open) { setLines([]); setNote(''); } }, [open]);
  const save = useMutation({
    mutationFn: () => stockOpsApi.createWriteOff({ location_id: location!, reason, note: note || undefined, items: lines.map(({ product_id, product_variant_id, quantity }) => ({ product_id, product_variant_id, quantity })) }),
    onSuccess: () => { toast.success('Đã xuất hủy'); void queryClient.invalidateQueries({ queryKey: ['stock-write-offs'] }); onOpenChange(false); },
    onError: (e) => toast.error(stockError(e)),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6"><SheetTitle>Xuất hủy hàng</SheetTitle><SheetDescription>Trừ tồn kho theo giá vốn hiện tại; không vượt quá tồn khả dụng.</SheetDescription></SheetHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Kho</Label><LocationSelect value={location} onChange={setLocation} /></div>
            <div className="space-y-2"><Label>Lý do</Label>
              <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WRITE_OFF_REASON_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <StockLinesEditor lines={lines} onChange={setLines} />
          <div className="space-y-2"><Label htmlFor="wo-note">Ghi chú</Label><Textarea id="wo-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button variant="destructive" disabled={!location || !lines.length || save.isPending} onClick={() => save.mutate()}>Xuất hủy</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
