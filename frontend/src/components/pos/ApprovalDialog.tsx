import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { posApi } from '@/lib/api/pos';

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientRequestId: string;
  requestedPercent: number;
  maxPercent: number;
  onApproved: (token: string) => void;
}

/**
 * A manager approves a discount on the cashier's screen by signing in with
 * their own account (a separate, non-persisted session). Their token is used
 * once to call /pos/discount-approvals; the result is bound to this cart.
 */
export function ApprovalDialog({ open, onOpenChange, clientRequestId, requestedPercent, maxPercent, onApproved }: ApprovalDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    try {
      const approver = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await approver.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error('Sai tài khoản hoặc mật khẩu');
      const result = await posApi.approveDiscount(data.session.access_token, { client_request_id: clientRequestId, discount_percent: Math.ceil(requestedPercent * 100) / 100 });
      await approver.auth.signOut({ scope: 'local' });
      toast.success('Đã phê duyệt giảm giá');
      setPassword('');
      onApproved(result.token);
      onOpenChange(false);
    } catch (error) {
      const message = axios.isAxiosError(error) ? (error.response?.data?.message ?? error.message) : (error as Error).message;
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Cần quản lý phê duyệt</DialogTitle>
          <DialogDescription>
            Giảm giá {requestedPercent.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}% vượt mức cho phép ({maxPercent}%). Quản lý nhập tài khoản để phê duyệt cho đơn này.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void approve();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="approver-email">Email quản lý</Label>
            <Input id="approver-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="approver-password">Mật khẩu</Label>
            <Input id="approver-password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Hủy</Button>
            <Button type="submit" disabled={busy || !email || !password}>{busy ? 'Đang kiểm tra…' : 'Phê duyệt'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
