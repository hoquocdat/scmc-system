import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReturnListQuery } from '@/lib/api/sales-returns';
import { presetRange, type DatePreset } from './useReportFilters';

export interface ReturnFilters extends ReturnListQuery {
  preset: DatePreset;
  from: string;
  to: string;
}

const KEYS = ['preset', 'from', 'to', 'storeId', 'kind', 'search', 'page'] as const;

/** Returns list filters kept in the URL. Defaults to this month. */
export function useReturnFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ReturnFilters>(() => {
    const preset = (params.get('preset') as DatePreset) || 'this_month';
    const range = preset === 'custom' ? presetRange('this_month') : presetRange(preset);
    return {
      preset,
      from: params.get('from') || range.from,
      to: params.get('to') || range.to,
      storeId: params.get('storeId') || undefined,
      kind: (params.get('kind') as ReturnFilters['kind']) || undefined,
      search: params.get('search') || undefined,
      page: Number(params.get('page')) || 1,
      pageSize: 50,
    };
  }, [params]);

  const setFilters = useCallback(
    (next: Partial<ReturnFilters>) => {
      const p = new URLSearchParams(params);
      for (const k of KEYS) {
        if (!(k in next)) continue;
        const v = next[k];
        if (v === undefined || v === null || v === '') p.delete(k);
        else p.set(k, String(v));
      }
      if (next.preset && next.preset !== 'custom') { p.delete('from'); p.delete('to'); }
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

  const query = useMemo<ReturnListQuery>(() => {
    const { preset, ...rest } = filters;
    void preset;
    return rest;
  }, [filters]);

  const activeCount = [filters.preset !== 'this_month', filters.storeId, filters.kind, filters.search].filter(Boolean).length;
  return { filters, query, setFilters, clearFilters, activeCount, openId: params.get('open'), setOpenId: (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set('open', id); else p.delete('open'); setParams(p); } };
}
