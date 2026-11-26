import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { customerGroupsApi, type CustomerGroup } from '@/lib/api/customer-groups';
import { priceBookError } from '@/lib/api/price-books';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CustomerGroup | null;
}

/** Create or rename a customer group. */
export function CustomerGroupFormDialog({ open, onOpenChange, group }: Props) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (!open) return;
    setCode(group?.code ?? '');
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
  }, [open, group]);

  const save = useMutation({
    mutationFn: () =>
      group
        ? customerGroupsApi.update(group.id, { name: name.trim(), description: description || undefined })
        : customerGroupsApi.create({ code: code.trim().toUpperCase(), name: name.trim(), description: description || undefined }),
    onSuccess: () => {
      toast.success(group ? 'Đã cập nhật nhóm' : 'Đã tạo nhóm');
      void queryClient.invalidateQueries({ queryKey: ['customer-groups'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(priceBookError(e).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? `Sửa nhóm ${group.name}` : 'Thêm nhóm khách hàng'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="cg-code">Mã</Label><Input id="cg-code" value={code} disabled={!!group} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WHOLESALE" /></div>
          <div className="space-y-2"><Label htmlFor="cg-name">Tên</Label><Input id="cg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Khách sỉ" /></div>
          <div className="space-y-2"><Label htmlFor="cg-desc">Mô tả</Label><Textarea id="cg-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!name.trim() || (!group && !code.trim()) || save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
