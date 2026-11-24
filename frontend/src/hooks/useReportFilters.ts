import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReportInterval, ReportQuery } from '@/lib/api/reports';

export const REPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** "YYYY-MM-DD" of an instant in Vietnam time. */
export function toReportDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  last_week: 'Tuần trước',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  this_year: 'Năm nay',
  custom: 'Tùy chọn',
};

/** Date range for a preset, in Vietnam calendar days (weeks start on Monday). */
export function presetRange(preset: DatePreset, now: Date = new Date()): { from: string; to: string } {
  const today = toReportDate(now);
  const [y, m] = today.split('-').map(Number);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const d = shiftDays(today, -1);
      return { from: d, to: d };
    }
    case 'this_week':
      return { from: shiftDays(today, -dow), to: shiftDays(today, 6 - dow) };
    case 'last_week':
      return { from: shiftDays(today, -dow - 7), to: shiftDays(today, -dow - 1) };
    case 'last_month': {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDayOfMonth(py, pm))}` };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'this_month':
    default:
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}` };
  }
}

export interface ReportFilters extends ReportQuery {
  from: string;
  to: string;
  preset: DatePreset;
}

const FILTER_KEYS = ['from', 'to', 'preset', 'storeId', 'interval', 'page', 'pageSize', 'limit', 'sortBy', 'productId', 'locationId', 'type'] as const;

/**
 * Report filters kept in the URL so they survive refresh and can be shared.
 * Defaults to the current month in Vietnam time (or the report's own default period).
 */
export function useReportFilters(defaults: Partial<ReportQuery> = {}, defaultPreset: DatePreset = 'this_month') {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ReportFilters>(() => {
    const preset = (searchParams.get('preset') as DatePreset) || defaultPreset;
    const range = preset === 'custom' ? null : presetRange(preset);
    const num = (k: string) => (searchParams.get(k) ? Number(searchParams.get(k)) : undefined);
    return {
      preset,
      from: searchParams.get('from') || range?.from || presetRange('this_month').from,
      to: searchParams.get('to') || range?.to || presetRange('this_month').to,
      storeId: searchParams.get('storeId') || defaults.storeId,
      interval: (searchParams.get('interval') as ReportInterval) || defaults.interval,
      page: num('page') ?? defaults.page,
      pageSize: num('pageSize') ?? defaults.pageSize,
      limit: num('limit') ?? defaults.limit,
      sortBy: searchParams.get('sortBy') || defaults.sortBy,
      productId: searchParams.get('productId') || undefined,
      locationId: searchParams.get('locationId') || undefined,
      type: searchParams.get('type') || undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilters = useCallback(
    (next: Partial<ReportFilters>, options: { resetPage?: boolean } = { resetPage: true }) => {
      const params = new URLSearchParams(searchParams);
      for (const key of FILTER_KEYS) {
        if (key in next) {
          const value = next[key];
          if (value === undefined || value === null || value === '') params.delete(key);
          else params.set(key, String(value));
        }
      }
      if (next.preset && next.preset !== 'custom') {
        params.delete('from');
        params.delete('to');
      }
      if (options.resetPage && !('page' in next)) params.delete('page');
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    for (const key of FILTER_KEYS) params.delete(key);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  /** Query parameters to send to the API (no UI-only keys). */
  const query = useMemo<ReportQuery>(() => {
    const rest: ReportQuery & { preset?: DatePreset } = { ...filters };
    delete rest.preset;
    return rest;
  }, [filters]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.preset !== defaultPreset) n++;
    if (filters.storeId) n++;
    if (filters.productId) n++;
    if (filters.locationId) n++;
    if (filters.type) n++;
    return n;
  }, [filters, defaultPreset]);

  return { filters, query, setFilters, clearFilters, activeCount, defaultPreset };
}
