import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { priceBookError, priceBooksApi, type ImportError } from '@/lib/api/price-books';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
}

/** Upload an xlsx of SKU / Variant SKU / Mode / Value; all rows or none are written. */
export function ImportEntriesDialog({ open, onOpenChange, bookId }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ message: string; rows?: ImportError[] } | null>(null);

  const run = useMutation({
    mutationFn: () => priceBooksApi.import(bookId, file!),
    onSuccess: (r) => {
      toast.success(`Đã nhập ${r.imported} dòng`);
      void queryClient.invalidateQueries({ queryKey: ['price-books'] });
      close(false);
    },
    onError: (e) => setErrors(priceBookError(e)),
  });

  const close = (o: boolean) => {
    if (!o) { setFile(null); setErrors(null); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhập bảng giá từ Excel</DialogTitle>
          <DialogDescription>
            Các cột: SKU, Variant SKU (tùy chọn), Mode (Giá cố định / Giảm % / Giảm tiền), Value. Mặt hàng đã có sẽ được cập nhật. Nếu có dòng lỗi, không dòng nào được ghi. Mẹo: xuất bảng giá hiện tại để có tệp mẫu.
          </DialogDescription>
        </DialogHeader>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors(null); }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> {file ? file.name : 'Chọn tệp .xlsx'}</Button>
        {errors && (
          <Alert variant="destructive">
            <AlertTitle>{errors.message}</AlertTitle>
            {errors.rows && (
              <AlertDescription>
                <ScrollArea className="max-h-48">
                  <ul className="space-y-0.5 text-sm">{errors.rows.map((r) => <li key={r.row}>Dòng {r.row}: {r.message}</li>)}</ul>
                </ScrollArea>
              </AlertDescription>
            )}
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Đóng</Button>
          <Button disabled={!file || run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Đang nhập…' : 'Nhập'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
