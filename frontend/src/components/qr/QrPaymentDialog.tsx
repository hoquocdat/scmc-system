import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { qrApi, qrError, QR_PROVIDER_LABELS, QR_STATUS_LABELS, type QrProviderName, type QrRequest } from '@/lib/api/qr-payments';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';
import { QrImage } from './QrImage';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  amount: number;
  clientRequestId?: string;
  posSessionId?: string;
  onPaid: (r: QrRequest) => void;
}

const secondsLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));

/** Shows a QR for the exact amount and waits for the payment (design D7). */
export function QrPaymentDialog({ open, onOpenChange, storeId, amount, clientRequestId, posSessionId, onPaid }: Props) {
  const { can } = usePermissions();
  const [provider, setProvider] = useState<QrProviderName>();
  const [requestId, setRequestId] = useState<string>();
  const [, tick] = useState(0);
  useEffect(() => { if (open) { setRequestId(undefined); setProvider(undefined); } }, [open]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const { data: providers = [] } = useQuery({ queryKey: ['qr', 'providers', storeId], queryFn: () => qrApi.providers(storeId), enabled: open });
  const create = useMutation({
    mutationFn: (p: QrProviderName) => qrApi.create({ store_id: storeId, provider: p, amount, client_request_id: clientRequestId, pos_session_id: posSessionId }),
    onSuccess: (r) => setRequestId(r.id),
    onError: (e) => toast.error(qrError(e)),
  });
  const { data: req, refetch } = useQuery({
    queryKey: ['qr', 'request', requestId],
    queryFn: () => qrApi.get(requestId!),
    enabled: !!requestId,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2000 : false),
  });
  useEffect(() => {
    if (req?.status === 'paid') { toast.success(`Đã nhận ${formatCurrency(req.amount)} qua ${QR_PROVIDER_LABELS[req.provider]}`); onPaid(req); onOpenChange(false); }
  }, [req, onPaid, onOpenChange]);

  const onError = (e: unknown) => toast.error(qrError(e));
  const check = useMutation({ mutationFn: () => qrApi.check(requestId!), onSuccess: () => void refetch(), onError });
  const confirm = useMutation({ mutationFn: () => qrApi.confirm(requestId!), onSuccess: () => void refetch(), onError });
  const cancel = useMutation({ mutationFn: () => qrApi.cancel(requestId!), onSuccess: () => { setRequestId(undefined); void refetch(); }, onError });
  const pick = (p: QrProviderName) => { setProvider(p); create.mutate(p); };
  const left = req ? secondsLeft(req.expires_at) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && req?.status === 'pending') cancel.mutate(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán QR {formatCurrency(amount)}</DialogTitle>
          <DialogDescription>Khách quét mã bằng ứng dụng ngân hàng hoặc ví. Đơn chỉ hoàn tất khi đã nhận tiền.</DialogDescription>
        </DialogHeader>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chi nhánh chưa bật thanh toán QR (Cài đặt → Thanh toán QR).</p>
        ) : (
          <Tabs value={provider ?? ''} onValueChange={(v) => pick(v as QrProviderName)}>
            <TabsList className="w-full">{providers.map((p) => <TabsTrigger key={p.provider} value={p.provider} disabled={create.isPending || req?.status === 'pending'}>{QR_PROVIDER_LABELS[p.provider].split(' ')[0]}</TabsTrigger>)}</TabsList>
          </Tabs>
        )}
        {req && (
          <div className="flex flex-col items-center gap-2">
            {req.qr_content && req.status === 'pending' && <QrImage value={req.qr_content} />}
            <div className="font-mono text-sm">{req.code}</div>
            <Badge variant={req.status === 'paid' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}>{QR_STATUS_LABELS[req.status]}{req.status === 'pending' ? ` · còn ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}</Badge>
            {req.failure_reason && <p className="text-sm text-destructive">{req.failure_reason}</p>}
            {req.provider === 'vietqr' && req.status === 'pending' && <p className="text-center text-xs text-muted-foreground">Nội dung chuyển khoản phải chứa mã {req.code}. Kiểm tra ứng dụng ngân hàng rồi bấm "Đã nhận tiền".</p>}
          </div>
        )}
        <DialogFooter className="gap-2">
          {req?.status === 'pending' && <Button variant="outline" onClick={() => cancel.mutate()}><XCircle className="h-4 w-4" /> Hủy mã</Button>}
          {req?.status === 'pending' && req.provider !== 'vietqr' && req.provider !== 'vnpay' && <Button variant="outline" disabled={check.isPending} onClick={() => check.mutate()}><RefreshCw className="h-4 w-4" /> Kiểm tra</Button>}
          {req?.status === 'pending' && req.provider === 'vietqr' && can('qr_payments', 'confirm') && <Button disabled={confirm.isPending} onClick={() => confirm.mutate()}><CheckCircle2 className="h-4 w-4" /> Đã nhận tiền</Button>}
          {req && req.status !== 'pending' && req.status !== 'paid' && provider && <Button onClick={() => pick(provider)}>Tạo mã mới</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
