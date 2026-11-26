import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CASH_BOOK_METHODS, cashBookApi, cashBookError, METHOD_LABELS, type CashBookMethod } from '@/lib/api/cash-book';
import { storesApi } from '@/lib/api/stores';
import { AccountSelect } from '../AccountSelect';

/** Which account receives each payment method, per branch. */
export function MethodMapTab() {
  const queryClient = useQueryClient();
  const { data: stores, isLoading } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll });
  const { data: map = [] } = useQuery({ queryKey: ['cash-book', 'method-map'], queryFn: () => cashBookApi.methodMap() });

  const save = useMutation({
    mutationFn: cashBookApi.setMethodAccount,
    onSuccess: () => { toast.success('Đã lưu'); void queryClient.invalidateQueries({ queryKey: ['cash-book'] }); },
    onError: (e) => toast.error(cashBookError(e)),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const current = (storeId: string, method: CashBookMethod) => map.find((m) => m.store_id === storeId && m.payment_method === method)?.account_id;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {stores?.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle>{s.name}</CardTitle>
            <CardDescription>Tiền thu bằng mỗi phương thức sẽ ghi vào tài khoản đã chọn. Phương thức chưa chọn sẽ báo lỗi khi thanh toán.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Phương thức</TableHead><TableHead>Tài khoản</TableHead></TableRow></TableHeader>
              <TableBody>
                {CASH_BOOK_METHODS.map((method) => (
                  <TableRow key={method}>
                    <TableCell className="whitespace-nowrap">{METHOD_LABELS[method]}</TableCell>
                    <TableCell>
                      <AccountSelect storeId={s.id} value={current(s.id, method)} placeholder="Chưa gán" onChange={(accountId) => accountId && save.mutate({ store_id: s.id, payment_method: method, account_id: accountId })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
