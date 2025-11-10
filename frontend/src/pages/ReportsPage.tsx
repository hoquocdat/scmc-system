import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

interface RevenueStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  completedOrders: number;
}

interface EmployeeStats {
  employee_name: string;
  orders_completed: number;
  total_revenue: number;
  avg_completion_days: number;
}

interface PartUsageStats {
  part_name: string;
  total_quantity: number;
  total_cost: number;
  times_used: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  order_count: number;
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [isUnderDevelopmentOpen, setIsUnderDevelopmentOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    completedOrders: 0,
  });
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [partUsageStats, setPartUsageStats] = useState<PartUsageStats[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);

  useEffect(() => {
    loadReports();
  }, [dateFrom, dateTo]);

  const loadReports = async () => {
    try {
      setIsLoading(true);

      // Revenue Statistics
      const { data: ordersData, error: ordersError } = await supabase
        .from('service_orders')
        .select('final_cost, estimated_cost, status, created_at, actual_completion_date, drop_off_date')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');

      if (ordersError) throw ordersError;

      const completedOrders = ordersData?.filter(o => o.status === 'delivered') || [];
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.final_cost || o.estimated_cost || 0), 0);
      const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      setRevenueStats({
        totalRevenue,
        totalOrders: ordersData?.length || 0,
        avgOrderValue,
        completedOrders: completedOrders.length,
      });

      // Employee Performance
      const { data: techData, error: techError } = await supabase
        .from('service_orders')
        .select(`
          assigned_employee_id,
          final_cost,
          estimated_cost,
          drop_off_date,
          actual_completion_date,
          user_profiles!service_orders_assigned_employee_id_fkey (
            full_name
          )
        `)
        .eq('status', 'delivered')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .not('assigned_employee_id', 'is', null);

      if (techError) throw techError;

      const techStatsMap = new Map<string, any>();
      techData?.forEach((order: any) => {
        const techId = order.assigned_employee_id;
        const techName = order.user_profiles?.full_name || 'Unknown';
        const revenue = order.final_cost || order.estimated_cost || 0;

        let completionDays = 0;
        if (order.drop_off_date && order.actual_completion_date) {
          const dropOff = new Date(order.drop_off_date);
          const completion = new Date(order.actual_completion_date);
          completionDays = Math.ceil((completion.getTime() - dropOff.getTime()) / (1000 * 60 * 60 * 24));
        }

        if (!techStatsMap.has(techId)) {
          techStatsMap.set(techId, {
            employee_name: techName,
            orders_completed: 0,
            total_revenue: 0,
            total_days: 0,
            avg_completion_days: 0,
          });
        }

        const stats = techStatsMap.get(techId);
        stats.orders_completed++;
        stats.total_revenue += revenue;
        stats.total_days += completionDays;
        stats.avg_completion_days = stats.total_days / stats.orders_completed;
      });

      setEmployeeStats(Array.from(techStatsMap.values()).sort((a, b) => b.total_revenue - a.total_revenue));

      // Part Usage Statistics
      const { data: partsData, error: partsError } = await supabase
        .from('service_parts')
        .select(`
          quantity_used,
          total_cost,
          created_at,
          parts (
            name
          )
        `)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');

      if (partsError) throw partsError;

      const partStatsMap = new Map<string, any>();
      partsData?.forEach((sp: any) => {
        const partName = sp.parts?.name || 'Unknown';

        if (!partStatsMap.has(partName)) {
          partStatsMap.set(partName, {
            part_name: partName,
            total_quantity: 0,
            total_cost: 0,
            times_used: 0,
          });
        }

        const stats = partStatsMap.get(partName);
        stats.total_quantity += sp.quantity_used;
        stats.total_cost += sp.total_cost;
        stats.times_used++;
      });

      setPartUsageStats(
        Array.from(partStatsMap.values())
          .sort((a, b) => b.total_cost - a.total_cost)
          .slice(0, 10)
      );

      // Monthly Revenue Trend
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('service_orders')
        .select('final_cost, estimated_cost, created_at')
        .eq('status', 'delivered')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');

      if (monthlyError) throw monthlyError;

      const monthlyMap = new Map<string, any>();
      monthlyData?.forEach((order) => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: monthKey,
            revenue: 0,
            order_count: 0,
          });
        }

        const stats = monthlyMap.get(monthKey);
        stats.revenue += order.final_cost || order.estimated_cost || 0;
        stats.order_count++;
      });

      setMonthlyRevenue(
        Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))
      );

    } catch (err: any) {
      console.error('Error loading reports:', err);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Report exported successfully');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          View business performance, trends, and insights
        </p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Date Range</CardTitle>
          <CardDescription className="text-sm">Select date range for reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
            <div className="flex-1">
              <Label htmlFor="date_from">From</Label>
              <Input
                id="date_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="date_to">To</Label>
              <Input
                id="date_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={loadReports} className="w-full sm:w-auto">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Overview */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${revenueStats.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From completed orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenueStats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Orders created
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenueStats.completedOrders}</div>
            <p className="text-xs text-muted-foreground">
              Orders delivered
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${revenueStats.avgOrderValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per completed order
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Trend */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Monthly Revenue Trend</CardTitle>
              <CardDescription className="text-sm">Revenue breakdown by month</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(monthlyRevenue, 'monthly_revenue')}
              className="w-full sm:w-auto"
            >
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : monthlyRevenue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data available for the selected period
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRevenue.map((item) => (
                    <TableRow key={item.month}>
                      <TableCell className="font-medium">{item.month}</TableCell>
                      <TableCell>{item.order_count}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ${item.revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell>
                      {monthlyRevenue.reduce((sum, m) => sum + m.order_count, 0)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Performance */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Employee Performance</CardTitle>
              <CardDescription className="text-sm">Performance metrics by employee</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(employeeStats, 'employee_performance')}
              className="w-full sm:w-auto"
            >
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : employeeStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data available for the selected period
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Orders Completed</TableHead>
                    <TableHead>Total Revenue</TableHead>
                    <TableHead>Avg Days to Complete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeStats.map((tech) => (
                    <TableRow key={tech.employee_name}>
                      <TableCell className="font-medium">{tech.employee_name}</TableCell>
                      <TableCell>{tech.orders_completed}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        ${tech.total_revenue.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {tech.avg_completion_days > 0 ? (
                          <Badge variant={tech.avg_completion_days <= 3 ? 'secondary' : 'default'}>
                            {tech.avg_completion_days.toFixed(1)} days
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Parts Used */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Top Parts Used</CardTitle>
              <CardDescription className="text-sm">Most frequently used parts by cost</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(partUsageStats, 'parts_usage')}
              className="w-full sm:w-auto"
            >
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : partUsageStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No parts usage data for the selected period
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Name</TableHead>
                    <TableHead>Times Used</TableHead>
                    <TableHead>Total Quantity</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partUsageStats.map((part) => (
                    <TableRow key={part.part_name}>
                      <TableCell className="font-medium">{part.part_name}</TableCell>
                      <TableCell>{part.times_used}</TableCell>
                      <TableCell>{part.total_quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${part.total_cost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Under Development Dialog */}
      <Dialog open={isUnderDevelopmentOpen} onOpenChange={(open) => {
        setIsUnderDevelopmentOpen(open);
        if (!open) {
          navigate('/');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tính năng đang phát triển</DialogTitle>
            <DialogDescription>
              Tính năng báo cáo và phân tích hiện đang trong quá trình phát triển và sẽ sớm được ra mắt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => {
              setIsUnderDevelopmentOpen(false);
              navigate('/');
            }}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
