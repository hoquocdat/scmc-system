import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Users,
  Store,
  Calendar,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import {
  salesApi,
  SALES_CHANNEL_LABELS,
  type SalesChannel,
} from '@/lib/api/sales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export function SalesReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get date range from URL or use defaults (current month)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const filters = useMemo(() => ({
    from_date: searchParams.get('from_date') || firstDayOfMonth.toISOString().split('T')[0],
    to_date: searchParams.get('to_date') || today.toISOString().split('T')[0],
  }), [searchParams]);

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['sales-statistics', filters],
    queryFn: () => salesApi.getStatistics(filters),
  });

  // Fetch employee report
  const { data: employeeReport, isLoading: employeeLoading } = useQuery({
    queryKey: ['sales-report-employee', filters],
    queryFn: () => salesApi.getReportByEmployee(filters),
  });

  // Fetch channel report
  const { data: channelReport, isLoading: channelLoading } = useQuery({
    queryKey: ['sales-report-channel', filters],
    queryFn: () => salesApi.getReportByChannel(filters),
  });

  // Calculate max values for progress bars
  const maxEmployeeRevenue = useMemo(() => {
    if (!employeeReport?.length) return 0;
    return Math.max(...employeeReport.map(e => e.total_revenue));
  }, [employeeReport]);

  const maxChannelRevenue = useMemo(() => {
    if (!channelReport?.length) return 0;
    return Math.max(...channelReport.map(c => c.total_revenue));
  }, [channelReport]);

  // Handle date change
  const handleDateChange = (key: 'from_date' | 'to_date', value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    setSearchParams(newParams);
  };

  // Quick date presets
  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'quarter') => {
    const newParams = new URLSearchParams(searchParams);
    const now = new Date();
    let fromDate: Date;

    switch (preset) {
      case 'today':
        fromDate = now;
        break;
      case 'week':
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
    }

    newParams.set('from_date', fromDate.toISOString().split('T')[0]);
    newParams.set('to_date', now.toISOString().split('T')[0]);
    setSearchParams(newParams);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Báo cáo bán hàng</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Thống kê doanh thu theo nhân viên và kênh bán hàng
            </p>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Khoảng thời gian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="from_date">Từ ngày</Label>
              <Input
                id="from_date"
                type="date"
                value={filters.from_date}
                onChange={(e) => handleDateChange('from_date', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="to_date">Đến ngày</Label>
              <Input
                id="to_date"
                type="date"
                value={filters.to_date}
                onChange={(e) => handleDateChange('to_date', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDatePreset('today')}>
                Hôm nay
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset('week')}>
                7 ngày
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset('month')}>
                Tháng này
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDatePreset('quarter')}>
                Quý này
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng đơn hàng</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalOrders || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đơn hoàn thành</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? '...' : stats?.completedOrders || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng doanh thu</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsLoading ? '...' : formatCurrency(stats?.totalRevenue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chiết khấu</CardTitle>
            <Percent className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {statsLoading ? '...' : formatCurrency(stats?.totalDiscounts || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="employee" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employee" className="gap-2">
            <Users className="h-4 w-4" />
            Theo nhân viên
          </TabsTrigger>
          <TabsTrigger value="channel" className="gap-2">
            <Store className="h-4 w-4" />
            Theo kênh bán
          </TabsTrigger>
        </TabsList>

        {/* Employee Report */}
        <TabsContent value="employee">
          <Card>
            <CardHeader>
              <CardTitle>Doanh thu theo nhân viên</CardTitle>
            </CardHeader>
            <CardContent>
              {employeeLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : !employeeReport?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có dữ liệu trong khoảng thời gian này
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead className="text-right">Số đơn</TableHead>
                      <TableHead>Doanh thu</TableHead>
                      <TableHead className="text-right">Chiết khấu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeReport.map((item, index) => (
                      <TableRow key={item.employee_id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{item.employee_name}</div>
                        </TableCell>
                        <TableCell className="text-right">{item.order_count}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {formatCurrency(item.total_revenue)}
                            </div>
                            <Progress
                              value={(item.total_revenue / maxEmployeeRevenue) * 100}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {formatCurrency(item.total_discount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Report */}
        <TabsContent value="channel">
          <Card>
            <CardHeader>
              <CardTitle>Doanh thu theo kênh bán hàng</CardTitle>
            </CardHeader>
            <CardContent>
              {channelLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Đang tải...
                </div>
              ) : !channelReport?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  Không có dữ liệu trong khoảng thời gian này
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Kênh bán hàng</TableHead>
                      <TableHead className="text-right">Số đơn</TableHead>
                      <TableHead>Doanh thu</TableHead>
                      <TableHead className="text-right">Chiết khấu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelReport.map((item, index) => (
                      <TableRow key={item.channel}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {SALES_CHANNEL_LABELS[item.channel as SalesChannel] || item.channel}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.order_count}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {formatCurrency(item.total_revenue)}
                            </div>
                            <Progress
                              value={(item.total_revenue / maxChannelRevenue) * 100}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {formatCurrency(item.total_discount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
