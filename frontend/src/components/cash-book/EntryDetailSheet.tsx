import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cashBookApi, cashBookError, COUNTERPARTY_LABELS, num, SOURCE_LABELS } from '@/lib/api/cash-book';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface EntryDetailSheetProps {
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
  canCancel: boolean;
}

/** One entry with its source, attachments and (for manual entries) cancellation. */
export function EntryDetailSheet({ entryId, onOpenChange, canCancel }: EntryDetailSheetProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const { data: e, isLoading } = useQuery({ queryKey: ['cash-book', 'entry', entryId], queryFn: () => cashBookApi.entry(entryId!), enabled: !!entryId });

  const cancel = useMutation({
    mutationFn: () => cashBookApi.cancel(entryId!, reason),
    onSuccess: () => {
      toast.success('Đã hủy phiếu');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['cash-book'] });
    },
    onError: (err) => toast.error(cashBookError(err)),
  });

  const rows: [string, React.ReactNode][] = e
    ? [
        ['Thời gian', formatDateTime(e.entry_date)],
        ['Tài khoản', `${e.cash_book_accounts.name} · ${e.stores.name}`],
        ['Loại thu chi', e.cash_book_categories.name],
        ['Số tiền', <span className={e.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}>{e.direction === 'in' ? '+' : '−'}{formatCurrency(num(e.amount))}</span>],
        ['Đối tượng', e.counterparty_type ? `${COUNTERPARTY_LABELS[e.counterparty_type]}${e.counterparty_name ? ` · ${e.counterparty_name}` : ''}` : '—'],
        ['Nguồn', e.is_automatic ? (SOURCE_LABELS[e.source_type ?? ''] ?? e.source_type ?? 'Tự động') : 'Phiếu nhập tay'],
        ['Diễn giải', e.note ?? '—'],
        ['Người lập', e.user_profiles_cash_book_entries_created_byTouser_profiles?.full_name ?? '—'],
      ]
    : [];

  return (
    <Sheet open={!!entryId} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle className="flex items-center gap-2">
            {e?.entry_number ?? 'Phiếu'}
            {e && <Badge variant={e.direction === 'in' ? 'secondary' : 'outline'}>{e.direction === 'in' ? 'Phiếu thu' : 'Phiếu chi'}</Badge>}
            {e?.status === 'cancelled' && <Badge variant="destructive">Đã hủy</Badge>}
          </SheetTitle>
          {e?.transfer_group_id && <SheetDescription>Một vế của phiếu chuyển quỹ; hủy sẽ hủy cả hai vế.</SheetDescription>}
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {e && (
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>))}
            </dl>
          )}
          {e?.status === 'cancelled' && (
            <Alert variant="destructive"><AlertDescription>Hủy lúc {e.cancelled_at ? formatDateTime(e.cancelled_at) : ''} bởi {e.user_profiles_cash_book_entries_cancelled_byTouser_profiles?.full_name ?? '—'}: {e.cancel_reason}</AlertDescription></Alert>
          )}
          {!!e?.attachments?.length && (
            <div className="space-y-1">
              <Label>Chứng từ</Label>
              {e.attachments.map((a) => (
                <a key={a.id} href={a.public_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm underline">
                  <Paperclip className="h-3 w-3" /> {a.file_name}
                </a>
              ))}
            </div>
          )}
          {e && e.status === 'posted' && e.is_automatic && (
            <Alert><AlertDescription>Phiếu tự động: muốn điều chỉnh hãy hủy/đảo chứng từ gốc (thanh toán, phiếu dịch vụ, …).</AlertDescription></Alert>
          )}
          {e && e.status === 'posted' && !e.is_automatic && canCancel && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Lý do hủy</Label>
                <Input id="cancel-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Bắt buộc" />
              </div>
            </>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          {e && e.status === 'posted' && !e.is_automatic && canCancel && (
            <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>Hủy phiếu</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
