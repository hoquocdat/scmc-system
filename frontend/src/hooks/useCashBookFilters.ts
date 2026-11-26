import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CashDirection, CounterpartyType, EntryQuery } from '@/lib/api/cash-book';
import { presetRange, type DatePreset } from './useReportFilters';

export interface CashBookFilters extends EntryQuery {
  preset: DatePreset;
  from: string;
  to: string;
}

const KEYS = ['preset', 'from', 'to', 'storeId', 'accountId', 'direction', 'categoryId', 'counterpartyType', 'counterparty', 'sourceType', 'status', 'page'] as const;

/** Cash book filters kept in the URL (refresh-safe, shareable). Defaults to today. */
export function useCashBookFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<CashBookFilters>(() => {
    const preset = (params.get('preset') as DatePreset) || 'today';
    const range = preset === 'custom' ? null : presetRange(preset);
    const get = (k: string) => params.get(k) || undefined;
    return {
      preset,
      from: get('from') ?? range?.from ?? presetRange('today').from,
      to: get('to') ?? range?.to ?? presetRange('today').to,
      storeId: get('storeId'),
      accountId: get('accountId'),
      direction: get('direction') as CashDirection | undefined,
      categoryId: get('categoryId'),
      counterpartyType: get('counterpartyType') as CounterpartyType | undefined,
      counterparty: get('counterparty'),
      sourceType: get('sourceType'),
      status: get('status') as 'posted' | 'cancelled' | undefined,
      page: params.get('page') ? Number(params.get('page')) : 1,
      pageSize: 50,
    };
  }, [params]);

  const setFilters = useCallback(
    (next: Partial<CashBookFilters>) => {
      const p = new URLSearchParams(params);
      for (const k of KEYS) {
        if (!(k in next)) continue;
        const v = next[k];
        if (v === undefined || v === null || v === '') p.delete(k);
        else p.set(k, String(v));
      }
      if (next.preset && next.preset !== 'custom') {
        p.delete('from');
        p.delete('to');
      }
      if (!('page' in next)) p.delete('page');
      setParams(p);
    },
    [params, setParams],
  );

  const clearFilters = useCallback(() => {
    const p = new URLSearchParams(params);
    for (const k of KEYS) p.delete(k);
    setParams(p);
  }, [params, setParams]);

  const query = useMemo<EntryQuery>(() => {
    const q: EntryQuery & { preset?: DatePreset } = { ...filters };
    delete q.preset;
    return q;
  }, [filters]);

  const activeCount = [filters.preset !== 'today', filters.storeId, filters.accountId, filters.direction, filters.categoryId, filters.counterpartyType, filters.counterparty, filters.sourceType, filters.status].filter(Boolean).length;

  return { filters, query, setFilters, clearFilters, activeCount };
}
