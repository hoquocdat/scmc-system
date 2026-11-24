import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StartCountSheet } from '@/components/stock/StartCountSheet';
import { stockOpsApi } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime } from '@/lib/utils';

const STATUS = { counting: 'Đang kiểm', completed: 'Đã cân bằng', cancelled: 'Đã hủy' } as const;
const SCOPE = { all: 'Toàn bộ kho', category: 'Danh mục', brand: 'Thương hiệu', products: 'Chọn sản phẩm' } as const;

/** Kiểm kho: counts per location with progress and status. */
export function CountsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['stock-counts'], queryFn: () => stockOpsApi.counts() });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-semibold sm:text-2xl">Kiểm kho</h1><p className="text-sm text-muted-foreground">Đếm thực tế, xem chênh lệch, rồi cân bằng tồn kho.</p></div>
        {can('inventory', 'count') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tạo phiếu kiểm</Button>}
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Phiếu</TableHead><TableHead>Kho</TableHead><TableHead>Phạm vi</TableHead><TableHead className="text-right">Đã đếm</TableHead><TableHead>Trạng thái</TableHead><TableHead>Tạo lúc</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Chưa có phiếu kiểm</TableCell></TableRow>}
              {data?.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/inventory/counts/${c.id}`)}>
                  <TableCell className="font-medium">{c.count_number}</TableCell>
                  <TableCell>{c.stock_locations.name}</TableCell>
                  <TableCell>{SCOPE[c.scope.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.counted_count} / {c.item_count}</TableCell>
                  <TableCell><Badge variant={c.status === 'counting' ? 'secondary' : 'outline'}>{STATUS[c.status]}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <StartCountSheet open={open} onOpenChange={setOpen} onStarted={(c) => navigate(`/inventory/counts/${c.id}`)} />
    </div>
  );
}
