import { useMemo, useState } from 'react';
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
  Filter,
  X,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export function SalesReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Get date range from URL or use defaults (current month)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const filters = useMemo(() => ({
    from_date: searchParams.get('from_date') || firstDayOfMonth.toISOString().split('T')[0],
    to_date: searchParams.get('to_date') || today.toISOString().split('T')[0],
    employee_id: searchParams.get('employee_id') || undefined,
  }), [searchParams]);

  // Fetch employees for filter dropdown (using sales endpoint)
  const { data: employees } = useQuery({
    queryKey: ['sales-employees'],
    queryFn: () => salesApi.getSalesEmployees(),
  });

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['sales-statistics', filters],
    queryFn: () => salesApi.getStatistics({
      from_date: filters.from_date,
      to_date: filters.to_date,
      created_by: filters.employee_id,
    }),
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

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.employee_id) count++;
    return count;
  }, [filters]);

  // Handle date change
  const handleDateChange = (key: 'from_date' | 'to_date', value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    setSearchParams(newParams);
  };

  // Handle employee filter change
  const handleEmployeeChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      newParams.delete('employee_id');
    } else {
      newParams.set('employee_id', value);
    }
    setSearchParams(newParams);
  };

  // Clear all filters
  const clearFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('employee_id');
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

  // Get selected employee name
  const selectedEmployeeName = useMemo(() => {
    if (!filters.employee_id || !employees) return null;
    const emp = employees.find(e => e.id === filters.employee_id);
    return emp?.name || null;
  }, [filters.employee_id, employees]);

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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Date range display */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{filters.from_date} - {filters.to_date}</span>
        </div>

        <div className="flex-1" />

        {/* Filter button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterSheetOpen(true)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Lọc
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Đang lọc:</span>
          {selectedEmployeeName && (
            <Badge variant="secondary" className="gap-1">
              Nhân viên: {selectedEmployeeName}
              <button
                onClick={() => handleEmployeeChange('all')}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* Summary Stats - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Tổng đơn</p>
              <p className="text-lg font-semibold">
                {statsLoading ? '...' : stats?.totalOrders || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Hoàn thành</p>
              <p className="text-lg font-semibold text-green-600">
                {statsLoading ? '...' : stats?.completedOrders || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Doanh thu</p>
              <p className="text-lg font-semibold text-blue-600 truncate">
                {statsLoading ? '...' : formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-orange-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Chiết khấu</p>
              <p className="text-lg font-semibold text-orange-500 truncate">
                {statsLoading ? '...' : formatCurrency(stats?.totalDiscounts || 0)}
              </p>
            </div>
          </div>
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

      {/* Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader className="px-6">
            <SheetTitle>Bộ lọc báo cáo</SheetTitle>
          </SheetHeader>
          <div className="px-6 py-6 space-y-6">
            {/* Date range */}
            <div className="space-y-3">
              <Label>Khoảng thời gian</Label>
              {/* Date presets */}
              <div className="flex flex-wrap gap-2">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="from_date" className="text-xs text-muted-foreground">Từ ngày</Label>
                  <Input
                    id="from_date"
                    type="date"
                    value={filters.from_date}
                    onChange={(e) => handleDateChange('from_date', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to_date" className="text-xs text-muted-foreground">Đến ngày</Label>
                  <Input
                    id="to_date"
                    type="date"
                    value={filters.to_date}
                    onChange={(e) => handleDateChange('to_date', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Employee filter */}
            <div className="space-y-2">
              <Label>Nhân viên</Label>
              <Select
                value={filters.employee_id || 'all'}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả nhân viên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả nhân viên</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="px-6 pb-6">
            <Button variant="outline" onClick={clearFilters}>
              Xóa bộ lọc
            </Button>
            <Button onClick={() => setFilterSheetOpen(false)}>
              Áp dụng
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
