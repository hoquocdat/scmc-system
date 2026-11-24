import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AccountSelect } from '@/components/cash-book/AccountSelect';
import { qrApi, qrError, QR_PROVIDER_LABELS, type QrProviderSettings } from '@/lib/api/qr-payments';

const FIELDS: Record<string, { config: [string, string][]; secrets: [string, string][]; hint: string }> = {
  vietqr: { config: [['bank_bin', 'Mã BIN ngân hàng (VD 970436)'], ['account_number', 'Số tài khoản'], ['account_name', 'Tên tài khoản']], secrets: [['webhook_secret', 'Khóa webhook ngân hàng (tùy chọn)']], hint: 'Không cần hợp đồng. Thu ngân xác nhận khi thấy tiền về, hoặc tự động qua webhook của dịch vụ báo biến động số dư.' },
  momo: { config: [['partner_code', 'Partner code']], secrets: [['access_key', 'Access key'], ['secret_key', 'Secret key']], hint: 'Hợp đồng MoMo Business; dán URL IPN bên dưới vào cổng đối tác.' },
  zalopay: { config: [['app_id', 'App ID']], secrets: [['key1', 'Key1'], ['key2', 'Key2']], hint: 'Hợp đồng ZaloPay Merchant; callback URL bên dưới.' },
  vnpay: { config: [['tmn_code', 'TMN code']], secrets: [['hash_secret', 'Hash secret']], hint: 'Hợp đồng VNPay; IPN URL bên dưới đăng ký với VNPay.' },
};

/** Settings of one QR provider at one branch; secrets are write-only. */
export function ProviderSettingsCard({ storeId, value }: { storeId: string; value: QrProviderSettings }) {
  const queryClient = useQueryClient();
  const f = FIELDS[value.provider];
  const [enabled, setEnabled] = useState(value.is_enabled);
  const [config, setConfig] = useState<Record<string, unknown>>(value.config);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [account, setAccount] = useState<string | undefined>(value.cash_account_id ?? undefined);
  useEffect(() => { setEnabled(value.is_enabled); setConfig(value.config); setAccount(value.cash_account_id ?? undefined); setSecrets({}); }, [value]);
  const save = useMutation({
    mutationFn: () => qrApi.saveSettings(storeId, value.provider, { is_enabled: enabled, config, secrets, cash_account_id: account ?? null }),
    onSuccess: () => { toast.success('Đã lưu'); void queryClient.invalidateQueries({ queryKey: ['qr', 'settings', storeId] }); },
    onError: (e) => toast.error(qrError(e)),
  });
  const sandbox = value.provider !== 'vietqr';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{QR_PROVIDER_LABELS[value.provider]}</CardTitle>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Bật" />
        </div>
        <CardDescription>{f.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {f.config.map(([k, label]) => (
          <div key={k} className="space-y-1"><Label htmlFor={`${value.provider}-${k}`}>{label}</Label><Input id={`${value.provider}-${k}`} value={String(config[k] ?? '')} onChange={(e) => setConfig((c) => ({ ...c, [k]: e.target.value }))} /></div>
        ))}
        {f.secrets.map(([k, label]) => (
          <div key={k} className="space-y-1"><Label htmlFor={`${value.provider}-${k}`}>{label}</Label><Input id={`${value.provider}-${k}`} type="password" autoComplete="new-password" placeholder={value.secrets[k] || 'Chưa nhập'} value={secrets[k] ?? ''} onChange={(e) => setSecrets((s) => ({ ...s, [k]: e.target.value }))} /></div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor={`${value.provider}-exp`}>Hết hạn sau (phút)</Label><Input id={`${value.provider}-exp`} type="number" min={2} max={60} value={String(config.expiry_minutes ?? 10)} onChange={(e) => setConfig((c) => ({ ...c, expiry_minutes: Number(e.target.value) || 10 }))} /></div>
          {sandbox && <Label className="flex items-center gap-2 pt-6 font-normal"><Switch checked={config.sandbox !== false} onCheckedChange={(v) => setConfig((c) => ({ ...c, sandbox: v }))} />Môi trường thử (sandbox)</Label>}
        </div>
        <div className="space-y-1"><Label>Tài khoản sổ quỹ nhận tiền</Label><AccountSelect storeId={storeId} value={account} onChange={setAccount} allowDefault defaultLabel="Theo ánh xạ phương thức của chi nhánh" /></div>
        <div className="space-y-1">
          <Label>{value.provider === 'vietqr' ? 'Webhook ngân hàng' : 'Callback / IPN URL'}</Label>
          <div className="flex gap-2"><Input readOnly value={value.callback_url} className="font-mono text-xs" /><Button variant="outline" size="icon" aria-label="Sao chép" onClick={() => void navigator.clipboard.writeText(value.callback_url).then(() => toast.success('Đã sao chép'))}><Copy className="h-4 w-4" /></Button></div>
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>Lưu</Button>
      </CardContent>
    </Card>
  );
}
