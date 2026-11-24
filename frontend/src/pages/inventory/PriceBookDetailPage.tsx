import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AddEntriesSheet } from '@/components/price-books/AddEntriesSheet';
import { ImportEntriesDialog } from '@/components/price-books/ImportEntriesDialog';
import { PriceBookEntriesTable } from '@/components/price-books/PriceBookEntriesTable';
import { PriceBookFormSheet } from '@/components/price-books/PriceBookFormSheet';
import { bookStatus, periodLabel } from '@/components/price-books/price-book-format';
import { priceBookError, priceBooksApi } from '@/lib/api/price-books';
import { saveBlob } from '@/lib/api/reports';
import { usePermissions } from '@/hooks/usePermissions';

/** One price book: its conditions and entries, with add, import and export. */
export function PriceBookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: book, isLoading } = useQuery({ queryKey: ['price-books', id], queryFn: () => priceBooksApi.get(id!), enabled: !!id });
  const canEdit = can('price_books', 'update');

  const exportFile = useMutation({
    mutationFn: () => priceBooksApi.export(id!),
    onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
    onError: () => toast.error('Xuất bảng giá thất bại'),
  });
  const remove = useMutation({
    mutationFn: () => priceBooksApi.remove(id!),
    onSuccess: () => {
      toast.success('Đã xóa bảng giá');
      void queryClient.invalidateQueries({ queryKey: ['price-books'] });
      navigate('/inventory/price-books');
    },
    onError: (e) => toast.error(priceBookError(e).message),
  });

  if (isLoading || !book) return <Skeleton className="h-64 w-full" />;
  const status = bookStatus(book);
  const facts: [string, string][] = [
    ['Thời gian', periodLabel(book)],
    ['Ưu tiên', String(book.priority)],
    ['Chi nhánh', book.all_stores ? 'Tất cả' : book.stores.map((s) => s.name).join(', ')],
    ['Khách hàng', book.all_customers ? 'Tất cả' : book.groups.map((g) => g.name).join(', ')],
    ['Chọn tay khi bán', book.allow_manual ? 'Cho phép' : 'Không'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Về danh sách"><Link to="/inventory/price-books"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold sm:text-2xl">{book.name} <Badge variant={status.variant}>{status.label}</Badge></h1>
            <p className="font-mono text-sm text-muted-foreground">{book.code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Thêm mặt hàng</Button>}
          {canEdit && <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Nhập Excel</Button>}
          <Button variant="outline" disabled={exportFile.isPending} onClick={() => exportFile.mutate()}><Download className="h-4 w-4" /> Xuất Excel</Button>
          {canEdit && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Sửa</Button>}
          {can('price_books', 'delete') && <Button variant="ghost" size="icon" aria-label="Xóa bảng giá" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          {facts.map(([k, v]) => (
            <div key={k}><div className="text-xs text-muted-foreground">{k}</div><div className="text-sm font-medium">{v}</div></div>
          ))}
        </CardContent>
      </Card>

      <PriceBookEntriesTable bookId={book.id} canEdit={canEdit} />

      <PriceBookFormSheet open={editOpen} onOpenChange={setEditOpen} book={book} />
      <AddEntriesSheet open={addOpen} onOpenChange={setAddOpen} bookId={book.id} />
      <ImportEntriesDialog open={importOpen} onOpenChange={setImportOpen} bookId={book.id} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bảng giá {book.name}?</AlertDialogTitle>
            <AlertDialogDescription>Đơn hàng đã bán giữ nguyên giá. Muốn tạm dừng, hãy tắt "Đang áp dụng" thay vì xóa.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
