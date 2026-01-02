import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi, type PayrollSlip } from '@/lib/api/payroll';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
} from 'lucide-react';
import { PayrollSlipStatusBadge } from '@/components/payroll/PayrollPeriodStatusBadge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

const formatCurrency = (value: number | undefined | null) => {
  if (!value) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string | undefined | null) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
};

export function EmployeePayrollPage() {
  const queryClient = useQueryClient();

  const [selectedSlip, setSelectedSlip] = useState<PayrollSlip | null>(null);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmComment, setConfirmComment] = useState('');

  // Fetch my payroll slips
  const { data: slips = [], isLoading } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: () => payrollApi.getMyPayroll({}),
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: () =>
      payrollApi.confirmSlip(selectedSlip!.id, {
        comment: confirmComment || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-payroll'] });
      toast.success('Đã xác nhận phiếu lương');
      setConfirmDialogOpen(false);
      setSelectedSlip(null);
      setConfirmComment('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Dispute mutation
  const disputeMutation = useMutation({
    mutationFn: () =>
      payrollApi.disputeSlip(selectedSlip!.id, { reason: disputeReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-payroll'] });
      toast.success('Khiếu nại của bạn đã được ghi nhận');
      setDisputeDialogOpen(false);
      setSelectedSlip(null);
      setDisputeReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleConfirmClick = (slip: PayrollSlip) => {
    setSelectedSlip(slip);
    setConfirmDialogOpen(true);
  };

  const handleDisputeClick = (slip: PayrollSlip) => {
    setSelectedSlip(slip);
    setDisputeDialogOpen(true);
  };

  if (isLoading) {
    return <div className="p-8 text-center">Đang tải...</div>;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Phiếu Lương Của Tôi
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Xem và xác nhận phiếu lương hàng tháng
        </p>
      </div>

      {slips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Chưa có phiếu lương nào
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {slips.map((slip) => (
            <Card key={slip.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {slip.payroll_periods?.period_name}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4" />
                      Tháng {slip.payroll_periods?.period_month}/
                      {slip.payroll_periods?.period_year}
                    </div>
                  </div>
                  <PayrollSlipStatusBadge status={slip.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Ngày công</div>
                    <div className="font-semibold">{Number(slip.total_work_days).toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Lương gộp</div>
                    <div className="font-semibold">{formatCurrency(slip.gross_pay)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Khấu trừ</div>
                    <div className="font-semibold text-red-600">
                      -{formatCurrency(slip.total_deductions)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Thực lãnh</div>
                    <div className="font-bold text-lg text-green-600">
                      {formatCurrency(slip.net_pay)}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-medium">Thu nhập</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lương cơ bản</span>
                      <span>{formatCurrency(slip.base_salary_amount)}</span>
                    </div>
                    {Number(slip.overtime_earnings) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tăng ca</span>
                        <span>{formatCurrency(slip.overtime_earnings)}</span>
                      </div>
                    )}
                    {Number(slip.allowances_amount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phụ cấp</span>
                        <span>{formatCurrency(slip.allowances_amount)}</span>
                      </div>
                    )}
                    {Number(slip.bonus_amount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Thưởng</span>
                        <span>{formatCurrency(slip.bonus_amount)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="font-medium">Khấu trừ</div>
                    {Number(slip.social_insurance_deduction) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">BHXH</span>
                        <span className="text-red-600">
                          -{formatCurrency(slip.social_insurance_deduction)}
                        </span>
                      </div>
                    )}
                    {Number(slip.health_insurance_deduction) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">BHYT</span>
                        <span className="text-red-600">
                          -{formatCurrency(slip.health_insurance_deduction)}
                        </span>
                      </div>
                    )}
                    {Number(slip.unemployment_insurance_deduction) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">BHTN</span>
                        <span className="text-red-600">
                          -{formatCurrency(slip.unemployment_insurance_deduction)}
                        </span>
                      </div>
                    )}
                    {Number(slip.absence_deduction) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nghỉ không phép</span>
                        <span className="text-red-600">
                          -{formatCurrency(slip.absence_deduction)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deadline warning */}
                {slip.status === 'published' && slip.payroll_periods?.confirmation_deadline && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Hạn xác nhận: {formatDate(slip.payroll_periods.confirmation_deadline)}
                  </div>
                )}

                {/* Adjustment info */}
                {Number(slip.adjustment_amount) !== 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm font-medium">Điều chỉnh</div>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm text-muted-foreground">
                        {slip.adjustment_reason}
                      </span>
                      <span
                        className={
                          Number(slip.adjustment_amount) > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {Number(slip.adjustment_amount) > 0 ? '+' : ''}
                        {formatCurrency(slip.adjustment_amount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Dispute info */}
                {slip.status === 'disputed' && slip.dispute_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm font-medium text-red-800">
                      Đang khiếu nại
                    </div>
                    <div className="text-sm text-red-700 mt-1">
                      {slip.dispute_reason}
                    </div>
                  </div>
                )}

                {/* Confirmed info */}
                {(slip.status === 'confirmed' || slip.status === 'finalized' || slip.status === 'paid') && slip.confirmed_at && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Đã xác nhận: {formatDate(slip.confirmed_at)}
                  </div>
                )}

                {/* Actions */}
                {slip.status === 'published' && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleConfirmClick(slip)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Xác nhận
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleDisputeClick(slip)}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Khiếu nại
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận phiếu lương</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xác nhận phiếu lương này? Sau khi xác nhận,
              bạn không thể thay đổi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Thực lãnh</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(selectedSlip?.net_pay)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ghi chú (không bắt buộc)</label>
              <Textarea
                value={confirmComment}
                onChange={(e) => setConfirmComment(e.target.value)}
                placeholder="Nhập ghi chú nếu có..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khiếu nại phiếu lương</DialogTitle>
            <DialogDescription>
              Vui lòng mô tả chi tiết vấn đề bạn gặp phải với phiếu lương này.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Lý do khiếu nại *</label>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Mô tả vấn đề bạn gặp phải..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisputeDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => disputeMutation.mutate()}
              disabled={!disputeReason.trim() || disputeMutation.isPending}
            >
              {disputeMutation.isPending ? 'Đang gửi...' : 'Gửi khiếu nại'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
