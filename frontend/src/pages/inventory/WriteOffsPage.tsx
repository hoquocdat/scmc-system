import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportMenu } from '@/components/reports/ExportMenu';
import { WriteOffSheet } from '@/components/stock/WriteOffSheet';
import { presetRange } from '@/hooks/useReportFilters';
import { stockOpsApi } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDateTime } from '@/lib/utils';

/** Xuất hủy: write-offs in a period with their cost. */
export function WriteOffsPage() {
  const { can } = usePermissions();
  const [range, setRange] = useState(presetRange('this_month'));
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['stock-write-offs', range], queryFn: () => stockOpsApi.writeOffs(range), placeholderData: keepPreviousData });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-semibold sm:text-2xl">Xuất hủy</h1><p className="text-sm text-muted-foreground">Hàng hư hỏng, mất, dùng nội bộ hoặc hết hạn.</p></div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" className="w-40" aria-label="Từ ngày" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Input type="date" className="w-40" aria-label="Đến ngày" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          <ExportMenu reportKey="inventory.write-offs" query={range} disabled={!data} />
          {can('inventory', 'write_off') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Xuất hủy</Button>}
        </div>
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Thời gian</TableHead><TableHead>Số phiếu</TableHead><TableHead>Kho</TableHead><TableHead>Lý do</TableHead><TableHead className="text-right">Số dòng</TableHead><TableHead className="text-right">Giá vốn</TableHead><TableHead>Người lập</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.rows.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Không có phiếu xuất hủy</TableCell></TableRow>}
              {data?.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="font-medium">{r.number}{r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}</TableCell>
                  <TableCell>{r.location}</TableCell><TableCell>{r.reason}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.lines}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.totalCost)}</TableCell>
                  <TableCell>{r.createdBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <WriteOffSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
