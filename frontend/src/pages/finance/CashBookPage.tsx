import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Filter, Minus, Plus, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiCards } from '@/components/reports/KpiCards';
import { ExportMenu } from '@/components/reports/ExportMenu';
import { CashBookFilterBadges } from '@/components/cash-book/CashBookFilterBadges';
import { CashBookFilterSheet } from '@/components/cash-book/CashBookFilterSheet';
import { CashBookTable } from '@/components/cash-book/CashBookTable';
import { EntryDetailSheet } from '@/components/cash-book/EntryDetailSheet';
import { TransferSheet } from '@/components/cash-book/TransferSheet';
import { VoucherSheet } from '@/components/cash-book/VoucherSheet';
import { cashBookApi, type CashDirection } from '@/lib/api/cash-book';
import { useCashBookFilters } from '@/hooks/useCashBookFilters';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';

/** Sổ quỹ: filtered entries, period totals, running balance per account, vouchers and transfers. */
export function CashBookPage() {
  const { filters, query, setFilters, clearFilters, activeCount } = useCashBookFilters();
  const { can } = usePermissions();
  const [filterOpen, setFilterOpen] = useState(false);
  const [voucher, setVoucher] = useState<CashDirection | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cash-book', 'entries', query],
    queryFn: () => cashBookApi.entries(query),
    placeholderData: keepPreviousData,
  });
  const meta = data?.meta;
  const single = !!filters.accountId;
  const kpis = meta
    ? [
        ...(single ? [{ label: 'Tồn đầu kỳ', value: formatCurrency(meta.opening ?? 0) }] : []),
        { label: 'Tổng thu', value: formatCurrency(meta.receipts) },
        { label: 'Tổng chi', value: formatCurrency(meta.payments) },
        single ? { label: 'Tồn cuối kỳ', value: formatCurrency(meta.closing ?? 0) } : { label: 'Chênh lệch thu − chi', value: formatCurrency(meta.net) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Sổ quỹ</h1>
          <p className="text-sm text-muted-foreground">Mọi khoản thu, chi theo tài khoản tiền mặt, ngân hàng và ví điện tử của từng chi nhánh.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('cash_book', 'receive') && <Button variant="outline" onClick={() => setVoucher('in')}><Plus className="h-4 w-4" /> Phiếu thu</Button>}
          {can('cash_book', 'pay') && <Button variant="outline" onClick={() => setVoucher('out')}><Minus className="h-4 w-4" /> Phiếu chi</Button>}
          {can('cash_book', 'transfer') && <Button variant="outline" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="h-4 w-4" /> Chuyển quỹ</Button>}
          <Button variant="outline" onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4" /> Lọc {activeCount > 0 && <Badge variant="secondary" className="ml-1 px-1.5">{activeCount}</Badge>}
          </Button>
          <ExportMenu reportKey="finance.cash-book" query={query} disabled={!data} />
          {can('cash_book', 'configure') && <Button asChild variant="ghost" size="icon" aria-label="Cài đặt sổ quỹ"><Link to="/settings/cash-book"><Settings className="h-4 w-4" /></Link></Button>}
        </div>
      </div>

      <CashBookFilterBadges filters={filters} activeCount={activeCount} onChange={setFilters} onClear={clearFilters} />
      <KpiCards items={kpis} isLoading={isLoading} />
      <CashBookTable rows={data?.rows} meta={meta} showBalance={single} isLoading={isFetching} onOpen={setEntryId} onPage={(page) => setFilters({ page })} />

      <CashBookFilterSheet open={filterOpen} onOpenChange={setFilterOpen} filters={filters} onApply={setFilters} onClear={clearFilters} />
      <VoucherSheet open={voucher !== null} onOpenChange={(o) => !o && setVoucher(null)} direction={voucher ?? 'in'} />
      <TransferSheet open={transferOpen} onOpenChange={setTransferOpen} />
      <EntryDetailSheet entryId={entryId} onOpenChange={(o) => !o && setEntryId(null)} canCancel={can('cash_book', 'cancel')} />
    </div>
  );
}
