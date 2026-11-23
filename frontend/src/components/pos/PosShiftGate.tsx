import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Store as StoreIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CURRENT_SHIFT_KEY, posApi, type PosShift } from '@/lib/api/pos';
import { storesApi } from '@/lib/api/stores';

function readLastStore(userId: string): string {
  try {
    return localStorage.getItem(`pos:lastStore:${userId}`) ?? '';
  } catch {
    return '';
  }
}

interface PosShiftGateProps {
  userId: string;
  children: (shift: PosShift) => ReactNode;
}

/** Renders the POS only inside an open shift; otherwise the open-shift form. Resumes an open shift on reload. */
export function PosShiftGate({ userId, children }: PosShiftGateProps) {
  const queryClient = useQueryClient();
  const shiftQuery = useQuery({
    queryKey: CURRENT_SHIFT_KEY,
    queryFn: posApi.getCurrentShift,
    retry: (count, error) => !(axios.isAxiosError(error) && error.response?.status === 404) && count < 2,
  });

  const [storeId, setStoreId] = useState(() => readLastStore(userId));
  const [openingCash, setOpeningCash] = useState<number | undefined>(0);
  const [notes, setNotes] = useState('');
  const stores = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll, enabled: shiftQuery.isError });

  const openMutation = useMutation({
    mutationFn: () => posApi.openShift({ store_id: storeId, opening_cash: openingCash ?? 0, notes: notes || undefined }),
    onSuccess: (shift) => {
      try {
        localStorage.setItem(`pos:lastStore:${userId}`, storeId);
      } catch {
        // ignore
      }
      queryClient.setQueryData(CURRENT_SHIFT_KEY, shift);
      toast.success(`Đã mở ca ${shift.session_number}`);
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.info('Bạn đang có một ca mở, tiếp tục ca đó.');
        void queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_KEY });
        return;
      }
      toast.error(axios.isAxiosError(error) ? (error.response?.data?.message ?? error.message) : 'Không mở được ca');
    },
  });

  if (shiftQuery.isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full max-w-md" />
      </div>
    );
  }

  if (shiftQuery.data && shiftQuery.data.status === 'open') {
    return <>{children(shiftQuery.data)}</>;
  }

  const notFound = axios.isAxiosError(shiftQuery.error) && shiftQuery.error.response?.status === 404;
  if (!notFound && shiftQuery.isError) {
    return (
      <div className="p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Không tải được ca làm việc</CardTitle>
            <CardDescription>Kiểm tra kết nối máy chủ rồi thử lại.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void shiftQuery.refetch()}>Thử lại</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><StoreIcon className="h-5 w-5" /> Mở ca bán hàng</CardTitle>
          <CardDescription>Chọn chi nhánh và khai báo tiền mặt đầu ca. Mỗi nhân viên chỉ có một ca mở.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Chi nhánh</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
              <SelectContent>
                {stores.data?.filter((s) => s.is_active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opening-cash">Tiền mặt đầu ca (VND)</Label>
            <CurrencyInput id="opening-cash" value={openingCash} onValueChange={setOpeningCash} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-notes">Ghi chú</Label>
            <Textarea id="shift-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button className="w-full" size="lg" disabled={!storeId || openMutation.isPending} onClick={() => openMutation.mutate()}>
            Mở ca
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
