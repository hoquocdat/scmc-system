import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { customerGroupsApi } from '@/lib/api/customer-groups';
import { priceBookError } from '@/lib/api/price-books';
import { usePermissions } from '@/hooks/usePermissions';

/** A customer's groups (wholesale, VIP, …); each change is saved immediately. */
export function CustomerGroupsSection({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canRead = can('customer_groups', 'read');
  const canEdit = can('customer_groups', 'update');
  const { data: all = [] } = useQuery({ queryKey: ['customer-groups'], queryFn: customerGroupsApi.list, enabled: canRead });
  const key = ['customer-groups', 'of', customerId];
  const { data: mine, isLoading } = useQuery({ queryKey: key, queryFn: () => customerGroupsApi.groupsOf(customerId), enabled: canRead });

  const save = useMutation({
    mutationFn: (ids: string[]) => customerGroupsApi.setGroupsOf(customerId, ids),
    onSuccess: (groups) => {
      queryClient.setQueryData(key, groups);
      void queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Đã cập nhật nhóm khách hàng');
    },
    onError: (e) => toast.error(priceBookError(e).message),
  });

  if (!canRead) return null;
  const selected = new Set(mine?.map((g) => g.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save.mutate([...next]);
  };
  const shown = all.filter((g) => g.is_active || selected.has(g.id));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Nhóm khách hàng</legend>
      <p className="text-xs text-muted-foreground">Dùng cho bảng giá riêng (giá sỉ, VIP, đối tác). Thay đổi được lưu ngay.</p>
      {isLoading ? <Skeleton className="h-16 w-full" /> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((g) => (
            <Label key={g.id} className="flex items-center gap-2 rounded-md border p-2 font-normal">
              <Checkbox checked={selected.has(g.id)} disabled={!canEdit || save.isPending} onCheckedChange={() => toggle(g.id)} />
              {g.name}
            </Label>
          ))}
          {shown.length === 0 && <p className="text-sm text-muted-foreground">Chưa có nhóm khách hàng.</p>}
        </div>
      )}
    </fieldset>
  );
}
