import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ACCOUNT_TYPE_LABELS, cashBookApi, cashBookError, type CashAccount } from '@/lib/api/cash-book';
import { formatCurrency } from '@/lib/utils';
import { AccountFormSheet } from './AccountFormSheet';

/** Accounts of every branch with current balance; create, edit, (de)activate. */
export function AccountsTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CashAccount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { data: accounts, isLoading } = useQuery({ queryKey: ['cash-book', 'accounts', 'all'], queryFn: () => cashBookApi.accounts() });

  const toggle = useMutation({
    mutationFn: (a: CashAccount) => cashBookApi.updateAccount(a.id, { is_active: !a.is_active }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['cash-book'] }),
    onError: (e) => toast.error(cashBookError(e)),
  });

  const open = (a: CashAccount | null) => { setEditing(a); setFormOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => open(null)}><Plus className="h-4 w-4" /> Thêm tài khoản</Button></div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chi nhánh</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Số dư</TableHead>
                <TableHead>Đang dùng</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.stores?.name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>
                    {a.name}
                    {a.is_pos_drawer && <Badge variant="secondary" className="ml-2">Két POS</Badge>}
                    {a.account_number && <div className="text-xs text-muted-foreground">{a.bank_name} · {a.account_number}</div>}
                  </TableCell>
                  <TableCell>{ACCOUNT_TYPE_LABELS[a.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(a.balance)}
                    {!a.opening_date && <div className="text-xs text-muted-foreground">chưa có số dư đầu kỳ</div>}
                  </TableCell>
                  <TableCell><Switch checked={a.is_active} disabled={toggle.isPending} onCheckedChange={() => toggle.mutate(a)} aria-label="Đang dùng" /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" aria-label="Sửa" onClick={() => open(a)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AccountFormSheet open={formOpen} onOpenChange={setFormOpen} account={editing} />
    </div>
  );
}
