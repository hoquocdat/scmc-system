import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountSelect } from '@/components/cash-book/AccountSelect';
import { REFUND_METHOD_LABELS, type RefundInput, type RefundMethod } from '@/lib/api/sales-returns';
import { cn, formatCurrency } from '@/lib/utils';

interface Props {
  rows: RefundInput[];
  onChange: (rows: RefundInput[]) => void;
  due: number;
  storeId?: string | null;
  hasCustomer: boolean;
}

const METHODS = Object.keys(REFUND_METHOD_LABELS).filter((m) => m !== 'exchange') as RefundMethod[];

/** How the refund is paid back: one or more methods adding up to what is due. */
export function RefundRows({ rows, onChange, due, storeId, hasCustomer }: Props) {
  const sum = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const set = (i: number, patch: Partial<RefundInput>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const methods = METHODS.filter((m) => m !== 'store_credit' || hasCustomer);

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[11rem_1fr_auto]">
          <Select value={r.method} onValueChange={(m) => set(i, { method: m as RefundMethod, cash_account_id: undefined })}>
            <SelectTrigger aria-label="Cách hoàn tiền"><SelectValue /></SelectTrigger>
            <SelectContent>{methods.map((m) => <SelectItem key={m} value={m}>{REFUND_METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
          </Select>
          <CurrencyInput aria-label="Số tiền hoàn" value={r.amount} onValueChange={(v) => set(i, { amount: v ?? 0 })} />
          <Button variant="ghost" size="icon" aria-label="Bỏ dòng" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          {r.method !== 'store_credit' && (
            <div className="sm:col-span-3">
              <AccountSelect storeId={storeId ?? undefined} value={r.cash_account_id} onChange={(id) => set(i, { cash_account_id: id })} allowDefault />
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between text-sm">
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, { method: 'cash', amount: Math.max(0, due - sum) }])} disabled={sum >= due}>
          <Plus className="h-4 w-4" /> Thêm cách hoàn
        </Button>
        <span className={cn('tabular-nums', Math.abs(sum - due) > 0.5 && 'font-medium text-destructive')}>
          {formatCurrency(sum)} / {formatCurrency(due)}
        </span>
      </div>
    </div>
  );
}
