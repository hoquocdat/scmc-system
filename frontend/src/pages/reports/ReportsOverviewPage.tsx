import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Info, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCards } from '@/components/reports/KpiCards';
import { canSeeReport, REPORT_DEFINITIONS, REPORT_GROUPS, reportPath } from '@/components/reports/report-registry';
import { reportsApi } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const BANNER_KEY = 'reports:corrected-figures-banner:v1';

function readBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

/** Landing page of the reports area: today's KPIs and links to every report group. */
export function ReportsOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const [bannerDismissed, setBannerDismissed] = useState(readBannerDismissed);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard', 'kpis'],
    queryFn: () => reportsApi.getDashboardKpis(),
    refetchInterval: 60_000,
  });

  const dismissBanner = () => {
    try {
      localStorage.setItem(BANNER_KEY, '1');
    } catch {
      // storage unavailable: banner just closes for this session
    }
    setBannerDismissed(true);
  };

  const kpis = data
    ? [
        { label: 'Doanh thu hôm nay', value: formatCurrency(data.today.combinedRevenue), hint: `Bán lẻ ${formatCurrency(data.today.retail.netSales)} · Xưởng ${formatCurrency(data.today.workshop.revenue)}` },
        { label: 'Doanh thu tháng này', value: formatCurrency(data.monthToDate.combinedRevenue), hint: `${data.monthToDate.retail.orders} đơn · ${data.monthToDate.workshop.orders} xe đã giao` },
        { label: 'Giá trị tồn kho', value: formatCurrency(data.inventory.stockValue), hint: `${data.inventory.lowStockCount} mặt hàng sắp hết` },
        { label: 'Xe trong xưởng', value: String(data.workshop.bikesInService) },
      ]
    : [];

  const visibleGroups = REPORT_GROUPS.filter((g) => !user?.role || g.roles.includes(user.role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Báo cáo</h1>
        <p className="text-sm text-muted-foreground">Cuối ngày, bán hàng, tồn kho, khách hàng, nhà cung cấp, khuyến mãi, tài chính và xưởng dịch vụ. Mọi báo cáo đều xuất được ra Excel/CSV.</p>
      </div>

      {!bannerDismissed && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            Số liệu báo cáo đã được điều chỉnh
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={dismissBanner} aria-label="Đóng">
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            Báo cáo nay chỉ tính đơn đã xác nhận trở đi (không tính nháp, chờ, hủy), không trừ giảm giá hai lần, tách tiền bán lẻ và tiền dịch vụ,
            dùng giá vốn tại thời điểm bán và tính ngày theo giờ Việt Nam. Con số có thể khác với trước đây.
          </AlertDescription>
        </Alert>
      )}

      <KpiCards items={kpis} isLoading={isLoading} />

      <div className="grid gap-4 md:grid-cols-2">
        {visibleGroups.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <CardTitle className="text-base">{g.label}</CardTitle>
              <CardDescription>{REPORT_DEFINITIONS.filter((d) => d.group === g.id && canSeeReport(d, user?.role)).length} báo cáo</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1">
              {REPORT_DEFINITIONS.filter((d) => d.group === g.id && canSeeReport(d, user?.role)).map((d) => (
                <Button key={d.key} asChild variant="ghost" className="justify-between">
                  <Link to={reportPath(d)}>
                    {d.title}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
