import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { payrollApi, type CreatePayrollPeriodDto } from '@/lib/api/payroll';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { CreatePayrollPeriodDialog } from '@/components/payroll/CreatePayrollPeriodDialog';
import { PayrollPeriodStatusBadge } from '@/components/payroll/PayrollPeriodStatusBadge';
import { toast } from 'sonner';

const formatCurrency = (value: number | undefined | null) => {
  if (!value) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
};

export function PayrollPeriodsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Fetch payroll periods
  const { data: periodsResponse, isLoading } = useQuery({
    queryKey: ['payroll-periods', selectedYear],
    queryFn: () => payrollApi.getPeriods({ year: selectedYear, limit: 50 }),
  });

  const periods = periodsResponse?.data || [];

  // Create period mutation
  const createMutation = useMutation({
    mutationFn: payrollApi.createPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast.success('Đã tạo kỳ lương mới');
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreatePeriod = async (data: CreatePayrollPeriodDto) => {
    await createMutation.mutateAsync(data);
  };

  const handleViewPeriod = (id: string) => {
    navigate(`/hrm/payroll/${id}`);
  };

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Kỳ Lương</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Quản lý các kỳ lương hàng tháng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                Năm {year}
              </option>
            ))}
          </select>

          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo Kỳ Lương
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Đang tải...</div>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Chưa có kỳ lương nào trong năm {selectedYear}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tạo Kỳ Lương Đầu Tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {periods.map((period) => (
            <Card
              key={period.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleViewPeriod(period.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{period.period_name}</CardTitle>
                  <PayrollPeriodStatusBadge status={period.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {period.period_code}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Period Dates */}
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formatDate(period.period_start_date)} - {formatDate(period.period_end_date)}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      {period.total_employees || 0} nhân viên
                    </span>
                  </div>

                  <div className="flex items-center">
                    <DollarSign className="mr-2 h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      {formatCurrency(period.total_net_pay)}
                    </span>
                  </div>
                </div>

                {/* Confirmation Status */}
                {period.status === 'published' && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-sm">
                      <span className="text-green-600">
                        {period.confirmed_count || 0} xác nhận
                      </span>
                      {(period.disputed_count || 0) > 0 && (
                        <span className="text-red-600 ml-2">
                          {period.disputed_count} khiếu nại
                        </span>
                      )}
                    </div>
                    {(period.disputed_count || 0) > 0 && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}

                {/* Deadline */}
                {period.confirmation_deadline && period.status === 'published' && (
                  <div className="text-xs text-muted-foreground">
                    Hạn xác nhận: {formatDate(period.confirmation_deadline)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePayrollPeriodDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreatePeriod}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
