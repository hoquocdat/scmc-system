import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomerGroupFormDialog } from '@/components/customers/CustomerGroupFormDialog';
import { customerGroupsApi, type CustomerGroup } from '@/lib/api/customer-groups';
import { priceBookError } from '@/lib/api/price-books';
import { usePermissions } from '@/hooks/usePermissions';

/** Nhóm khách hàng: groups targeted by price books, with member counts. */
export function CustomerGroupsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editing, setEditing] = useState<CustomerGroup | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { data: groups, isLoading } = useQuery({ queryKey: ['customer-groups'], queryFn: customerGroupsApi.list });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
  const onError = (e: unknown) => toast.error(priceBookError(e).message);
  const toggle = useMutation({ mutationFn: (g: CustomerGroup) => customerGroupsApi.update(g.id, { is_active: !g.is_active }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (g: CustomerGroup) => customerGroupsApi.remove(g.id), onSuccess: () => { toast.success('Đã xóa nhóm'); refresh(); }, onError });
  const open = (g: CustomerGroup | null) => { setEditing(g); setFormOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Về khách hàng"><Link to="/customers"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Nhóm khách hàng</h1>
            <p className="text-sm text-muted-foreground">Gán khách hàng vào nhóm ở trang chỉnh sửa khách hàng; bảng giá có thể áp dụng riêng cho từng nhóm.</p>
          </div>
        </div>
        {can('customer_groups', 'create') && <Button onClick={() => open(null)}><Plus className="h-4 w-4" /> Thêm nhóm</Button>}
      </div>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead className="text-right">Khách hàng</TableHead>
                <TableHead className="text-right">Bảng giá</TableHead>
                <TableHead>Đang dùng</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups?.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Chưa có nhóm khách hàng</TableCell></TableRow>}
              {groups?.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><div className="font-medium">{g.name}</div><div className="font-mono text-xs text-muted-foreground">{g.code}</div></TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{g.description}</TableCell>
                  <TableCell className="text-right tabular-nums"><Link className="underline" to={`/customers?groupId=${g.id}`}>{g.member_count}</Link></TableCell>
                  <TableCell className="text-right tabular-nums">{g.price_book_count}</TableCell>
                  <TableCell><Switch checked={g.is_active} disabled={!can('customer_groups', 'update') || toggle.isPending} onCheckedChange={() => toggle.mutate(g)} aria-label="Đang dùng" /></TableCell>
                  <TableCell>
                    <div className="flex">
                      {can('customer_groups', 'update') && <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => open(g)}><Pencil className="h-4 w-4" /></Button>}
                      {can('customer_groups', 'delete') && <Button size="icon" variant="ghost" aria-label="Xóa" disabled={remove.isPending} onClick={() => remove.mutate(g)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CustomerGroupFormDialog open={formOpen} onOpenChange={setFormOpen} group={editing} />
    </div>
  );
}
