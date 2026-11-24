import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderSettingsCard } from '@/components/qr/ProviderSettingsCard';
import { qrApi } from '@/lib/api/qr-payments';
import { storesApi } from '@/lib/api/stores';

/** Thanh toán QR: providers per branch, credentials (write-only) and callback URLs. */
export function QrPaymentsSettingsPage() {
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: storesApi.getAll });
  const [storeId, setStoreId] = useState<string>();
  const current = storeId ?? stores[0]?.id;
  const { data: settings, isLoading } = useQuery({ queryKey: ['qr', 'settings', current], queryFn: () => qrApi.settings(current!), enabled: !!current });
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-semibold sm:text-2xl">Thanh toán QR</h1><p className="text-sm text-muted-foreground">Bật VietQR, MoMo, ZaloPay, VNPay cho từng chi nhánh. Khóa bí mật được mã hóa và không hiển thị lại.</p></div>
        <Select value={current ?? ''} onValueChange={setStoreId}><SelectTrigger className="w-64"><SelectValue placeholder="Chi nhánh" /></SelectTrigger><SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
      </div>
      {isLoading || !settings || !current ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid gap-4 lg:grid-cols-2">{settings.map((s) => <ProviderSettingsCard key={s.provider} storeId={current} value={s} />)}</div>
      )}
    </div>
  );
}
