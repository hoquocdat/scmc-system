import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi, type PayrollSlip } from '@/lib/api/payroll';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Upload,
  Calculator,
  Send,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { PayrollPeriodStatusBadge } from '@/components/payroll/PayrollPeriodStatusBadge';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { createPayrollSlipColumns } from '@/components/payroll/PayrollSlipTableColumns';
import { toast } from 'sonner';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/payroll/ConfirmDialog';

const formatCurrency = (value: number | undefined | null) => {
  if (!value) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
};

export function PayrollPeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {},
  });

  // Fetch period details
  const { data: period, isLoading: isLoadingPeriod } = useQuery({
    queryKey: ['payroll-period', id],
    queryFn: () => payrollApi.getPeriod(id!),
    enabled: !!id,
  });

  // Fetch slips
  const { data: slips = [], isLoading: isLoadingSlips } = useQuery({
    queryKey: ['payroll-slips', id],
    queryFn: () => payrollApi.getSlipsForPeriod(id!),
    enabled: !!id,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () => payrollApi.generatePayroll(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-slips', id] });
      toast.success(`Đã tạo ${result.generatedSlips} phiếu lương`);
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} lỗi khi tạo phiếu lương`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: () => payrollApi.publishPeriod(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-slips', id] });
      toast.success('Đã công bố kỳ lương cho nhân viên');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: (overrideReason?: string) =>
      payrollApi.finalizePeriod(id!, { override_reason: overrideReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-slips', id] });
      toast.success('Đã hoàn thành kỳ lương');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mark paid mutation
  const markPaidMutation = useMutation({
    mutationFn: () => payrollApi.markPaid(id!, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-slips', id] });
      toast.success('Đã đánh dấu đã thanh toán');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleGenerate = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Tạo phiếu lương',
      description: 'Hệ thống sẽ tính toán lương cho tất cả nhân viên dựa trên dữ liệu chấm công đã nhập. Bạn có chắc chắn?',
      action: async () => { await generateMutation.mutateAsync(); },
    });
  };

  const handlePublish = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Công bố kỳ lương',
      description: 'Nhân viên sẽ nhìn thấy phiếu lương của họ và có thể xác nhận hoặc khiếu nại. Bạn có chắc chắn?',
      action: async () => { await publishMutation.mutateAsync(); },
    });
  };

  const handleFinalize = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hoàn thành kỳ lương',
      description: 'Sau khi hoàn thành, phiếu lương không thể chỉnh sửa. Bạn có chắc chắn?',
      action: async () => { await finalizeMutation.mutateAsync(undefined); },
    });
  };

  const handleMarkPaid = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đánh dấu đã thanh toán',
      description: 'Xác nhận đã thanh toán lương cho tất cả nhân viên trong kỳ này?',
      action: async () => { await markPaidMutation.mutateAsync(); },
    });
  };

  const handleViewSlip = (slip: PayrollSlip) => {
    // Could open a detail modal or navigate to slip detail page
    console.log('View slip:', slip);
  };

  const columns = createPayrollSlipColumns({ onView: handleViewSlip });

  if (isLoadingPeriod) {
    return <div className="p-8 text-center">Đang tải...</div>;
  }

  if (!period) {
    return <div className="p-8 text-center">Không tìm thấy kỳ lương</div>;
  }

  // Calculate stats
  const confirmedCount = slips.filter((s) => s.status === 'confirmed' || s.status === 'finalized' || s.status === 'paid').length;
  const disputedCount = slips.filter((s) => s.status === 'disputed').length;
  const totalGross = slips.reduce((sum, s) => sum + Number(s.gross_pay || 0), 0);
  const totalDeductions = slips.reduce((sum, s) => sum + Number(s.total_deductions || 0), 0);
  const totalNet = slips.reduce((sum, s) => sum + Number(s.net_pay || 0), 0);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/hrm/payroll')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">{period.period_name}</h1>
            <PayrollPeriodStatusBadge status={period.status} />
          </div>
          <p className="text-muted-foreground">{period.period_code}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {period.status === 'draft' && (
          <>
            <Button variant="outline" asChild>
              <Link to={`/hrm/payroll/${id}/attendance`}>
                <Upload className="mr-2 h-4 w-4" />
                Nhập chấm công
              </Link>
            </Button>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
              <Calculator className="mr-2 h-4 w-4" />
              {generateMutation.isPending ? 'Đang tính...' : 'Tính lương'}
            </Button>
            {slips.length > 0 && (
              <Button onClick={handlePublish} disabled={publishMutation.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Công bố
              </Button>
            )}
          </>
        )}

        {period.status === 'published' && (
          <Button onClick={handleFinalize} disabled={finalizeMutation.isPending}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Hoàn thành
          </Button>
        )}

        {period.status === 'finalized' && (
          <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending}>
            <CreditCard className="mr-2 h-4 w-4" />
            Đánh dấu đã thanh toán
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nhân viên
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slips.length}</div>
            {period.status === 'published' && (
              <p className="text-xs text-muted-foreground">
                {confirmedCount} xác nhận / {disputedCount > 0 && (
                  <span className="text-red-600">{disputedCount} khiếu nại</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng lương gộp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng khấu trừ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency(totalDeductions)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng thực lãnh
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalNet)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {disputedCount > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">
            Có {disputedCount} phiếu lương đang bị khiếu nại cần xử lý
          </span>
        </div>
      )}

      {/* Slips Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Danh sách phiếu lương
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={slips}
            isLoading={isLoadingSlips}
            searchColumn="user_profiles_payroll_slips_employee_idTouser_profiles.full_name"
            searchPlaceholder="Tìm theo tên nhân viên..."
          />
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.action}
      />
    </div>
  );
}
