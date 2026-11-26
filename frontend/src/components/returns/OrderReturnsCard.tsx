import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { salesReturnsApi } from '@/lib/api/sales-returns';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface Props {
  orderId: string;
  items: { id: string; product_name: string; quantity: number; returned_quantity?: number | null }[];
}

/** Returns of one order and the quantities taken back per line. */
export function OrderReturnsCard({ orderId, items }: Props) {
  const { data } = useQuery({ queryKey: ['sales-returns', 'order', orderId], queryFn: () => salesReturnsApi.list({ orderId, pageSize: 100 }) });
  const returnedLines = items.filter((i) => (i.returned_quantity ?? 0) > 0);
  if (!data?.rows.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Trả hàng / đổi hàng</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {returnedLines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {returnedLines.map((i) => <Badge key={i.id} variant="secondary">{i.product_name}: đã trả {i.returned_quantity}/{i.quantity}</Badge>)}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phiếu</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-right">Giá trị</TableHead>
              <TableHead className="text-right">Hoàn tiền</TableHead>
              <TableHead>Đơn đổi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link className="font-medium underline-offset-2 hover:underline" to={`/sales/returns?open=${r.id}`}>{r.returnNumber}</Link> <span className="text-xs text-muted-foreground">{r.kind}</span></TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.goodsAmount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.refundAmount)}</TableCell>
                <TableCell>{r.exchangeOrder}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
