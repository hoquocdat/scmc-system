import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { salesReturnsApi } from '@/lib/api/sales-returns';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';

const SOURCE_LABELS: Record<string, string> = {
  sales_return: 'Trả hàng',
  sales_order_payment: 'Dùng thanh toán',
  adjustment: 'Điều chỉnh',
};

/** Tiền trả hàng: credit kept for the customer from returns, and where it was used. */
export function CustomerCreditTab({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['customers', customerId, 'credit'], queryFn: () => salesReturnsApi.customerCredit(customerId) });
  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiền trả hàng: {formatCurrency(data.balance)}</CardTitle>
        <CardDescription>Khách dùng số dư này để thanh toán ở POS hoặc đơn hàng (phương thức "Tiền trả hàng").</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Thời gian</TableHead><TableHead>Nguồn</TableHead><TableHead>Ghi chú</TableHead><TableHead className="text-right">Số tiền</TableHead><TableHead className="text-right">Số dư</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.transactions.length === 0 && <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">Chưa có giao dịch</TableCell></TableRow>}
            {data.transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(t.created_at)}</TableCell>
                <TableCell>{SOURCE_LABELS[t.source_type] ?? t.source_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.note}</TableCell>
                <TableCell className={cn('text-right tabular-nums', t.amount < 0 ? 'text-red-700' : 'text-emerald-700')}>{formatCurrency(t.amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(t.balance_after)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
