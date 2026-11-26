import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACCOUNT_TYPE_LABELS, cashBookApi, type CashAccount } from '@/lib/api/cash-book';
import { formatCurrency } from '@/lib/utils';

const DEFAULT = '__default__';

interface AccountSelectProps {
  value?: string;
  onChange: (accountId: string | undefined) => void;
  storeId?: string;
  /** Offer a "no account chosen" option (value undefined). */
  allowDefault?: boolean;
  /** Text of the allowDefault option. */
  defaultLabel?: string;
  /** Hide POS drawer accounts. */
  excludeDrawer?: boolean;
  /** Hide these accounts (e.g. the source of a transfer). */
  exclude?: string[];
  placeholder?: string;
  id?: string;
  showBalance?: boolean;
}

/** Active cash book accounts grouped by branch; used by vouchers, transfers, supplier payments, payroll and shifts. */
export function AccountSelect({ value, onChange, storeId, allowDefault, defaultLabel = 'Mặc định theo phương thức thanh toán', excludeDrawer, exclude = [], placeholder = 'Chọn tài khoản quỹ', id, showBalance }: AccountSelectProps) {
  const { data: accounts = [] } = useQuery({ queryKey: ['cash-book', 'accounts', storeId ?? 'all'], queryFn: () => cashBookApi.accounts(storeId) });
  const active = accounts.filter((a) => a.is_active && !exclude.includes(a.id) && !(excludeDrawer && a.is_pos_drawer));
  const byStore = new Map<string, CashAccount[]>();
  for (const a of active) {
    const key = a.stores?.name ?? a.store_id;
    byStore.set(key, [...(byStore.get(key) ?? []), a]);
  }

  return (
    <Select value={value ?? (allowDefault ? DEFAULT : '')} onValueChange={(v) => onChange(v === DEFAULT ? undefined : v)}>
      <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowDefault && <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>}
        {[...byStore.entries()].map(([store, list]) => (
          <SelectGroup key={store}>
            {list.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} · {ACCOUNT_TYPE_LABELS[a.type]}
                {byStore.size > 1 ? ` · ${store}` : ''}
                {showBalance ? ` · ${formatCurrency(a.balance)}` : ''}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
