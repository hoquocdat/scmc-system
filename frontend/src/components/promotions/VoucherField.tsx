import { useEffect, useState } from 'react';
import { Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CartBreakdown } from '@/lib/api/promotions';
import { formatCurrency } from '@/lib/utils';

interface Props {
  code: string | null;
  /** The server's verdict on the code for this cart. */
  result: CartBreakdown['voucher'];
  onApply: (code: string | null) => void;
}

/** Voucher code entry with the amount or the reason it is refused. */
export function VoucherField({ code, result, onApply }: Props) {
  const [text, setText] = useState(code ?? '');
  useEffect(() => setText(code ?? ''), [code]);
  if (code) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          <Ticket className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{code}</span>
          {result && !result.ok && <span className="truncate text-xs text-destructive">· {result.reason}</span>}
          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Bỏ voucher" onClick={() => onApply(null)}><X className="h-3 w-3" /></Button>
        </span>
        <span className="tabular-nums">{result?.ok ? `-${formatCurrency(result.amount)}` : '—'}</span>
      </div>
    );
  }
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onApply(text.trim().toUpperCase()); }}>
      <Input className="h-8" placeholder="Mã voucher" aria-label="Mã voucher" value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" variant="outline" size="sm" disabled={!text.trim()}>Áp dụng</Button>
    </form>
  );
}
