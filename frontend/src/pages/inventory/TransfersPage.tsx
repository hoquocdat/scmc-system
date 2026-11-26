import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TransferCreateSheet } from '@/components/stock/TransferCreateSheet';
import { stockOpsApi, TRANSFER_STATUS_LABELS, type TransferStatus } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime } from '@/lib/utils';

const ALL = '__all__';
const transferBadge = (s: TransferStatus) => (s === 'received' ? 'default' : s === 'cancelled' ? 'outline' : 'secondary') as 'default' | 'outline' | 'secondary';

/** Chuyển kho: transfers between locations with their state and quantities. */
export function TransfersPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [status, setStatus] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['stock-transfers', status], queryFn: () => stockOpsApi.transfers({ status: status === ALL ? undefined : status, pageSize: 100 }), placeholderData: keepPreviousData });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-semibold sm:text-2xl">Chuyển kho</h1><p className="text-sm text-muted-foreground">Chuyển hàng giữa chi nhánh, kho tổng và xưởng: xuất ở kho đi, nhận ở kho đến.</p></div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Mọi trạng thái</SelectItem>{Object.entries(TRANSFER_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          {can('inventory', 'transfer') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo phiếu</Button>}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Phiếu</TableHead><TableHead>Tuyến</TableHead><TableHead className="text-right">Yêu cầu / xuất / nhận</TableHead><TableHead>Trạng thái</TableHead><TableHead>Tạo lúc</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.data.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Chưa có phiếu chuyển kho</TableCell></TableRow>}
              {data?.data.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/inventory/transfers/${t.id}`)}>
                  <TableCell className="font-medium">{t.transfer_number}</TableCell>
                  <TableCell className="text-sm"><span className="inline-flex items-center gap-1">{t.from.name} <ArrowRight className="h-3 w-3" /> {t.to.name}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{t.quantity_requested} / {t.quantity_shipped} / {t.quantity_received}{t.quantity_discrepancy > 0 && <span className="text-destructive"> (thiếu {t.quantity_discrepancy})</span>}</TableCell>
                  <TableCell><Badge variant={transferBadge(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(t.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <TransferCreateSheet open={open} onOpenChange={setOpen} onCreated={(t) => navigate(`/inventory/transfers/${t.id}`)} />
    </div>
  );
}
