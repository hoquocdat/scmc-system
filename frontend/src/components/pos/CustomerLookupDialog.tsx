import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Phone, Search, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { customersApi } from '@/lib/api/customers';
import type { CartCustomer } from '@/hooks/usePosCarts';

interface CustomerLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: CartCustomer | null, newCustomer?: { name: string; phone: string }) => void;
}

/** Find a customer by phone or name, register one quickly (name + phone), or sell to a walk-in. */
export function CustomerLookupDialog({ open, onOpenChange, onSelect }: CustomerLookupDialogProps) {
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['customers', 'pos-lookup', query],
    queryFn: () => customersApi.getAll({ search: query, limit: 8 }),
    enabled: open && query.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
  const customers = data?.data ?? [];
  const looksLikePhone = /^\+?\d[\d\s]{7,}$/.test(query.trim());

  const pick = (c: CartCustomer | null, n?: { name: string; phone: string }) => {
    onSelect(c, n);
    onOpenChange(false);
    setQuery('');
    setNewName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Khách hàng</DialogTitle>
          <DialogDescription>Nhập số điện thoại hoặc tên. Khách mới chỉ cần tên và số điện thoại.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus className="pl-9" placeholder="Số điện thoại hoặc tên…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Đang tìm…</p>}
          {!isLoading && query.trim().length >= 2 && customers.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Không tìm thấy khách hàng</p>}
          {customers.map((c) => (
            <Button key={c.id} variant="ghost" className="h-auto w-full justify-between py-2" onClick={() => pick({ id: c.id, full_name: c.full_name, phone: c.phone })}>
              <span className="text-left">
                <span className="block font-medium">{c.full_name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {c.phone}</span>
              </span>
            </Button>
          ))}
        </div>

        {looksLikePhone && customers.length === 0 && !isLoading && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="new-customer-name" className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> Đăng ký nhanh với số {query.trim()}</Label>
              <div className="flex gap-2">
                <Input id="new-customer-name" placeholder="Tên khách hàng" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button disabled={!newName.trim()} onClick={() => pick(null, { name: newName.trim(), phone: query.trim() })}>Thêm</Button>
              </div>
            </div>
          </>
        )}

        <Separator />
        <Button variant="secondary" className="w-full" onClick={() => pick(null)}>
          <Users className="h-4 w-4" /> Khách lẻ (không lưu thông tin)
        </Button>
      </DialogContent>
    </Dialog>
  );
}
