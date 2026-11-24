import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { KpiCards } from '@/components/reports/KpiCards';
import { TrendChart } from '@/components/reports/TrendChart';
import { ReportTable } from '@/components/reports/ReportTable';
import { findReport, findReportByKey } from '@/components/reports/report-registry';
import { useReportFilters } from '@/hooks/useReportFilters';
import { reportsApi, type PagedMeta } from '@/lib/api/reports';

/** Renders any report from the registry: filters, KPIs, chart, table, export. */
export function ReportPage() {
  const { group, slug } = useParams();
  const definition = findReport(group, slug);
  if (!definition) return <Navigate to="/reports" replace />;
  return <ReportBody key={definition.key} definitionKey={definition.key} />;
}

function ReportBody({ definitionKey }: { definitionKey: string }) {
  const definition = useMemo(() => {
    const d = findReportByKey(definitionKey);
    if (!d) throw new Error(`Unknown report ${definitionKey}`);
    return d;
  }, [definitionKey]);
  const { filters, query, setFilters, clearFilters, activeCount, defaultPreset } = useReportFilters(definition.defaultQuery, definition.defaultPreset);
  const needsProduct = !!definition.filters.product?.required && !query.productId;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['reports', definition.key, query],
    queryFn: () => reportsApi.get(definition.key, query),
    placeholderData: keepPreviousData,
    enabled: !needsProduct,
  });

  const kpis = data && definition.kpis ? definition.kpis(data) : [];
  const notice = data && definition.notice ? definition.notice(data) : null;
  const paging = definition.paged && data?.meta && typeof data.meta.total === 'number'
    ? { meta: data.meta as unknown as PagedMeta, onPageChange: (page: number) => setFilters({ page }, { resetPage: false }) }
    : undefined;

  return (
    <ReportLayout
      title={definition.title}
      description={definition.description}
      reportKey={definition.key}
      filters={filters}
      query={query}
      filterOptions={definition.filters}
      activeCount={activeCount}
      defaultPreset={defaultPreset}
      onFiltersChange={setFilters}
      onClearFilters={clearFilters}
      exportDisabled={!data || isLoading || needsProduct}
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Không tải được báo cáo</AlertTitle>
          <AlertDescription>{(error as { response?: { data?: { message?: string } } }).response?.data?.message ?? (error as Error).message}</AlertDescription>
        </Alert>
      )}

      {needsProduct && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Chọn sản phẩm</AlertTitle>
          <AlertDescription>Bấm "Lọc" và chọn một sản phẩm để xem thẻ kho.</AlertDescription>
        </Alert>
      )}

      {(definition.kpis || isLoading) && <KpiCards items={kpis} isLoading={isLoading || isFetching} />}

      {notice && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Số liệu ước tính</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {definition.chart && <TrendChart result={data} spec={definition.chart} />}

      {definition.extra && data && definition.extra(data)}

      {!definition.hideTable && <ReportTable result={data} isLoading={isLoading || isFetching} hidden={definition.hidden} paging={paging} />}

      {data && !needsProduct && (
        <p className="text-xs text-muted-foreground">
          Kỳ {data.scope.from} → {data.scope.to}, múi giờ {data.scope.timeZone}. Chỉ tính đơn đã xác nhận trở đi; đơn nháp, chờ và đã hủy không được tính.
        </p>
      )}
    </ReportLayout>
  );
}

