import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PaymentMethodRow, RevenueMeta } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';

interface ReceivedByMethodProps {
  received?: RevenueMeta['received'];
}

const BLOCKS: { key: keyof RevenueMeta['received']; title: string }[] = [
  { key: 'retail', title: 'Bán lẻ' },
  { key: 'workshop', title: 'Dịch vụ xưởng' },
  { key: 'combined', title: 'Tổng hợp' },
];

/** Money received per payment method, side by side for retail, workshop and combined. */
export function ReceivedByMethod({ received }: ReceivedByMethodProps) {
  if (!received) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {BLOCKS.map((b) => (
        <Card key={b.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tiền đã thu · {b.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <MethodTable rows={received[b.key]} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MethodTable({ rows }: { rows: PaymentMethodRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phương thức</TableHead>
          <TableHead className="text-right">Số tiền</TableHead>
          <TableHead className="text-right">GD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Không có giao dịch</TableCell></TableRow>
        )}
        {rows.map((r) => (
          <TableRow key={r.method}>
            <TableCell>{r.label}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.payments}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell>Tổng</TableCell>
          <TableCell className="text-right tabular-nums">{formatCurrency(total)}</TableCell>
          <TableCell className="text-right tabular-nums">{rows.reduce((s, r) => s + r.payments, 0)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
