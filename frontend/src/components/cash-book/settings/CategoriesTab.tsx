import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cashBookApi, cashBookError, type CashCategory, type CashDirection } from '@/lib/api/cash-book';

/** Receipt and payment categories; system ones are fixed, custom ones can be added, renamed, hidden or deleted when unused. */
export function CategoriesTab() {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['cash-book', 'categories'], queryFn: () => cashBookApi.categories() });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['cash-book', 'categories'] });
  const onError = (e: unknown) => toast.error(cashBookError(e));

  const create = useMutation({ mutationFn: cashBookApi.createCategory, onSuccess: refresh, onError });
  const update = useMutation({ mutationFn: ({ id, ...dto }: { id: string; name?: string; is_active?: boolean }) => cashBookApi.updateCategory(id, dto), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: cashBookApi.deleteCategory, onSuccess: () => { toast.success('Đã xóa'); refresh(); }, onError });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(['in', 'out'] as CashDirection[]).map((direction) => (
        <CategoryCard
          key={direction}
          title={direction === 'in' ? 'Loại thu' : 'Loại chi'}
          items={categories.filter((c) => c.direction === direction)}
          onAdd={(name) => create.mutate({ name, direction })}
          onRename={(c, name) => update.mutate({ id: c.id, name })}
          onToggle={(c) => update.mutate({ id: c.id, is_active: !c.is_active })}
          onDelete={(c) => remove.mutate(c.id)}
        />
      ))}
    </div>
  );
}

interface CategoryCardProps {
  title: string;
  items: CashCategory[];
  onAdd: (name: string) => void;
  onRename: (c: CashCategory, name: string) => void;
  onToggle: (c: CashCategory) => void;
  onDelete: (c: CashCategory) => void;
}

function CategoryCard({ title, items, onAdd, onRename, onToggle, onDelete }: CategoryCardProps) {
  const [name, setName] = useState('');
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(''); } }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên loại mới" />
          <Button type="submit" variant="outline" disabled={!name.trim()}><Plus className="h-4 w-4" /> Thêm</Button>
        </form>
        <Table>
          <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Dùng</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.is_system ? (
                    <span>{c.name} <Badge variant="outline" className="ml-1">Hệ thống</Badge></span>
                  ) : (
                    <Input defaultValue={c.name} className="h-8" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && onRename(c, e.target.value.trim())} />
                  )}
                </TableCell>
                <TableCell><Switch checked={c.is_active} disabled={c.is_system} onCheckedChange={() => onToggle(c)} aria-label="Đang dùng" /></TableCell>
                <TableCell>{!c.is_system && <Button variant="ghost" size="icon" aria-label="Xóa" onClick={() => onDelete(c)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
