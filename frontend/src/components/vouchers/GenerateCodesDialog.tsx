import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { promotionError } from '@/lib/api/promotions';
import { vouchersApi } from '@/lib/api/vouchers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  defaultPrefix: string;
}

/** A batch of random codes with a prefix, or one chosen code. */
export function GenerateCodesDialog({ open, onOpenChange, campaignId, defaultPrefix }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [count, setCount] = useState(50);
  const [prefix, setPrefix] = useState(defaultPrefix);
  const [code, setCode] = useState('');
  useEffect(() => { if (open) { setPrefix(defaultPrefix); setCode(''); } }, [open, defaultPrefix]);

  const run = useMutation({
    mutationFn: () => vouchersApi.generate(campaignId, mode === 'batch' ? { count, prefix } : { code }),
    onSuccess: (r) => { toast.success(`Đã tạo ${r.created} mã`); void queryClient.invalidateQueries({ queryKey: ['vouchers'] }); onOpenChange(false); },
    onError: (e) => toast.error(promotionError(e).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo mã voucher</DialogTitle>
          <DialogDescription>Mã ngẫu nhiên không dùng các ký tự dễ nhầm (0/O, 1/I/L). Mã không phân biệt hoa thường khi khách nhập.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'batch' | 'single')}>
          <TabsList><TabsTrigger value="batch">Tạo hàng loạt</TabsTrigger><TabsTrigger value="single">Một mã cụ thể</TabsTrigger></TabsList>
          <TabsContent value="batch" className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-2"><Label htmlFor="g-count">Số lượng</Label><Input id="g-count" type="number" min={1} max={10000} value={count} onChange={(e) => setCount(Math.min(10_000, Math.max(1, Number(e.target.value) || 1)))} /></div>
            <div className="space-y-2"><Label htmlFor="g-prefix">Tiền tố</Label><Input id="g-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} /></div>
            <p className="col-span-2 text-xs text-muted-foreground">VD: {prefix}K7Q2MZ</p>
          </TabsContent>
          <TabsContent value="single" className="space-y-2 pt-2">
            <Label htmlFor="g-code">Mã</Label>
            <Input id="g-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} placeholder="VIPANH" />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={run.isPending || (mode === 'single' && code.length < 3)} onClick={() => run.mutate()}>Tạo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
