import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { periodText, statusOf } from '@/components/promotions/datetime';
import { CampaignFormSheet } from '@/components/vouchers/CampaignFormSheet';
import { vouchersApi } from '@/lib/api/vouchers';
import { campaignValue } from '@/components/vouchers/campaign-format';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';

/** Voucher: campaigns with value, validity and usage; opens the codes page. */
export function VouchersPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campaigns, isLoading } = useQuery({ queryKey: ['vouchers'], queryFn: vouchersApi.list });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Voucher</h1>
          <p className="text-sm text-muted-foreground">Chương trình voucher và mã phát cho khách. Mỗi đơn dùng một mã, áp dụng sau khuyến mãi và trước điểm thưởng.</p>
        </div>
        {can('vouchers', 'create') && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Thêm chương trình</Button>}
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chương trình</TableHead><TableHead>Giá trị</TableHead><TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Mã đã dùng / tổng</TableHead><TableHead className="text-right">Đã giảm</TableHead><TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns?.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Chưa có chương trình voucher</TableCell></TableRow>}
              {campaigns?.map((c) => {
                const st = statusOf(c);
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/inventory/vouchers/${c.id}`)}>
                    <TableCell><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.code}</div></TableCell>
                    <TableCell className="text-sm">{campaignValue(c)}{c.min_order_amount ? <div className="text-xs text-muted-foreground">Đơn từ {formatCurrency(c.min_order_amount)}</div> : null}</TableCell>
                    <TableCell className="text-sm">{periodText(c.start_at, c.end_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.stats.used_codes} / {c.stats.codes}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.stats.discount)}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <CampaignFormSheet open={createOpen} onOpenChange={setCreateOpen} campaign={null} onSaved={(c) => navigate(`/inventory/vouchers/${c.id}`)} />
    </div>
  );
}
