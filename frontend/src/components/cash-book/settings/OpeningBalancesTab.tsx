import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cashBookApi, cashBookError } from '@/lib/api/cash-book';
import { toReportDate } from '@/hooks/useReportFilters';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AccountSelect } from '../AccountSelect';

/** Record the starting balance of an account; balances count from that date. */
export function OpeningBalancesTab() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string>();
  const [amount, setAmount] = useState<number>();
  const [date, setDate] = useState(toReportDate(new Date()));
  const { data: accounts = [] } = useQuery({ queryKey: ['cash-book', 'accounts', 'all'], queryFn: () => cashBookApi.accounts() });

  const save = useMutation({
    mutationFn: () => cashBookApi.createOpeningBalance({ account_id: accountId!, amount: amount ?? 0, date }),
    onSuccess: () => {
      toast.success('Đã ghi số dư đầu kỳ');
      setAmount(undefined);
      setAccountId(undefined);
      void queryClient.invalidateQueries({ queryKey: ['cash-book'] });
    },
    onError: (e) => toast.error(cashBookError(e)),
  });

  const withOpening = accounts.filter((a) => a.opening_date);
  return (
    <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nhập số dư đầu kỳ</CardTitle>
          <CardDescription>Số tiền thực có trong tài khoản vào đầu ngày đã chọn. Mỗi tài khoản chỉ có một số dư đầu kỳ; muốn sửa, hủy phiếu cũ trong sổ quỹ rồi nhập lại.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Tài khoản</Label><AccountSelect value={accountId} onChange={setAccountId} exclude={withOpening.map((a) => a.id)} /></div>
          <div className="space-y-2"><Label htmlFor="ob-date">Ngày</Label><Input id="ob-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="ob-amount">Số dư</Label><CurrencyInput id="ob-amount" value={amount} onValueChange={setAmount} /></div>
          <Button className="w-full" disabled={!accountId || !amount || !date || save.isPending} onClick={() => save.mutate()}>Lưu số dư đầu kỳ</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {accounts.length > withOpening.length && (
          <Alert><AlertDescription>{accounts.length - withOpening.length} tài khoản chưa có số dư đầu kỳ: số dư của chúng chỉ tính từ các phiếu đã ghi.</AlertDescription></Alert>
        )}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Tài khoản</TableHead><TableHead>Chi nhánh</TableHead><TableHead>Tính từ ngày</TableHead><TableHead className="text-right">Số dư hiện tại</TableHead></TableRow></TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.stores?.name}</TableCell>
                  <TableCell>{a.opening_date ? formatDate(a.opening_date) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(a.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
