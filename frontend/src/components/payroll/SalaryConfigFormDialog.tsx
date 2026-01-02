import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SalaryConfig, CreateSalaryConfigDto, EmployeeInfo } from '@/lib/api/salary-config';

interface SalaryConfigFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSalaryConfigDto) => Promise<void>;
  editingConfig: SalaryConfig | null;
  availableEmployees: EmployeeInfo[];
  isLoading?: boolean;
}

interface FormData {
  employee_id: string;
  salary_type: 'monthly' | 'daily' | 'hourly';
  base_salary: number;
  standard_work_days_per_month: number;
  standard_hours_per_day: number;
  overtime_rate_weekday: number;
  overtime_rate_weekend: number;
  overtime_rate_holiday: number;
  lunch_allowance: number;
  transport_allowance: number;
  phone_allowance: number;
  social_insurance_rate: number;
  health_insurance_rate: number;
  unemployment_insurance_rate: number;
  notes: string;
}

export function SalaryConfigFormDialog({
  isOpen,
  onClose,
  onSubmit,
  editingConfig,
  availableEmployees,
  isLoading = false,
}: SalaryConfigFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      salary_type: 'monthly',
      standard_work_days_per_month: 26,
      standard_hours_per_day: 8,
      overtime_rate_weekday: 1.5,
      overtime_rate_weekend: 2.0,
      overtime_rate_holiday: 3.0,
      lunch_allowance: 0,
      transport_allowance: 0,
      phone_allowance: 0,
      social_insurance_rate: 0.08,
      health_insurance_rate: 0.015,
      unemployment_insurance_rate: 0.01,
      notes: '',
    },
  });

  const selectedSalaryType = watch('salary_type');

  useEffect(() => {
    if (editingConfig) {
      reset({
        employee_id: editingConfig.employee_id,
        salary_type: editingConfig.salary_type,
        base_salary: Number(editingConfig.base_salary),
        standard_work_days_per_month: editingConfig.standard_work_days_per_month || 26,
        standard_hours_per_day: Number(editingConfig.standard_hours_per_day) || 8,
        overtime_rate_weekday: Number(editingConfig.overtime_rate_weekday) || 1.5,
        overtime_rate_weekend: Number(editingConfig.overtime_rate_weekend) || 2.0,
        overtime_rate_holiday: Number(editingConfig.overtime_rate_holiday) || 3.0,
        lunch_allowance: Number(editingConfig.lunch_allowance) || 0,
        transport_allowance: Number(editingConfig.transport_allowance) || 0,
        phone_allowance: Number(editingConfig.phone_allowance) || 0,
        social_insurance_rate: Number(editingConfig.social_insurance_rate) || 0.08,
        health_insurance_rate: Number(editingConfig.health_insurance_rate) || 0.015,
        unemployment_insurance_rate: Number(editingConfig.unemployment_insurance_rate) || 0.01,
        notes: editingConfig.notes || '',
      });
    } else {
      reset({
        employee_id: '',
        salary_type: 'monthly',
        base_salary: 0,
        standard_work_days_per_month: 26,
        standard_hours_per_day: 8,
        overtime_rate_weekday: 1.5,
        overtime_rate_weekend: 2.0,
        overtime_rate_holiday: 3.0,
        lunch_allowance: 0,
        transport_allowance: 0,
        phone_allowance: 0,
        social_insurance_rate: 0.08,
        health_insurance_rate: 0.015,
        unemployment_insurance_rate: 0.01,
        notes: '',
      });
    }
  }, [editingConfig, reset]);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      ...data,
      base_salary: Number(data.base_salary),
      standard_work_days_per_month: Number(data.standard_work_days_per_month),
      standard_hours_per_day: Number(data.standard_hours_per_day),
      overtime_rate_weekday: Number(data.overtime_rate_weekday),
      overtime_rate_weekend: Number(data.overtime_rate_weekend),
      overtime_rate_holiday: Number(data.overtime_rate_holiday),
      lunch_allowance: Number(data.lunch_allowance),
      transport_allowance: Number(data.transport_allowance),
      phone_allowance: Number(data.phone_allowance),
      social_insurance_rate: Number(data.social_insurance_rate),
      health_insurance_rate: Number(data.health_insurance_rate),
      unemployment_insurance_rate: Number(data.unemployment_insurance_rate),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? 'Chỉnh Sửa Cấu Hình Lương' : 'Thêm Cấu Hình Lương Mới'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Employee Selection */}
          {!editingConfig && (
            <div className="space-y-2">
              <Label htmlFor="employee_id">Nhân viên *</Label>
              <Select
                onValueChange={(value) => setValue('employee_id', value)}
                disabled={!!editingConfig}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhân viên" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.employee_code ? `${emp.employee_code} - ` : ''}{emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employee_id && (
                <p className="text-sm text-red-500">{errors.employee_id.message}</p>
              )}
            </div>
          )}

          {/* Salary Type and Base Salary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary_type">Loại lương *</Label>
              <Select
                value={selectedSalaryType}
                onValueChange={(value: 'monthly' | 'daily' | 'hourly') =>
                  setValue('salary_type', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Theo tháng</SelectItem>
                  <SelectItem value="daily">Theo ngày</SelectItem>
                  <SelectItem value="hourly">Theo giờ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_salary">
                Lương cơ bản (VND) *
              </Label>
              <Input
                id="base_salary"
                type="number"
                {...register('base_salary', { required: 'Bắt buộc', min: 0 })}
              />
            </div>
          </div>

          {/* Work Standards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="standard_work_days_per_month">Ngày công chuẩn/tháng</Label>
              <Input
                id="standard_work_days_per_month"
                type="number"
                {...register('standard_work_days_per_month')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="standard_hours_per_day">Giờ chuẩn/ngày</Label>
              <Input
                id="standard_hours_per_day"
                type="number"
                step="0.5"
                {...register('standard_hours_per_day')}
              />
            </div>
          </div>

          {/* Overtime Rates */}
          <div>
            <Label className="text-base font-semibold">Hệ số tăng ca</Label>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="overtime_rate_weekday" className="text-sm text-muted-foreground">
                  Ngày thường
                </Label>
                <Input
                  id="overtime_rate_weekday"
                  type="number"
                  step="0.1"
                  {...register('overtime_rate_weekday')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtime_rate_weekend" className="text-sm text-muted-foreground">
                  Cuối tuần
                </Label>
                <Input
                  id="overtime_rate_weekend"
                  type="number"
                  step="0.1"
                  {...register('overtime_rate_weekend')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtime_rate_holiday" className="text-sm text-muted-foreground">
                  Ngày lễ
                </Label>
                <Input
                  id="overtime_rate_holiday"
                  type="number"
                  step="0.1"
                  {...register('overtime_rate_holiday')}
                />
              </div>
            </div>
          </div>

          {/* Allowances */}
          <div>
            <Label className="text-base font-semibold">Phụ cấp (VND)</Label>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="lunch_allowance" className="text-sm text-muted-foreground">
                  Ăn trưa
                </Label>
                <Input
                  id="lunch_allowance"
                  type="number"
                  {...register('lunch_allowance')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport_allowance" className="text-sm text-muted-foreground">
                  Đi lại
                </Label>
                <Input
                  id="transport_allowance"
                  type="number"
                  {...register('transport_allowance')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_allowance" className="text-sm text-muted-foreground">
                  Điện thoại
                </Label>
                <Input
                  id="phone_allowance"
                  type="number"
                  {...register('phone_allowance')}
                />
              </div>
            </div>
          </div>

          {/* Insurance Rates */}
          <div>
            <Label className="text-base font-semibold">Tỷ lệ bảo hiểm (phần trăm)</Label>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="social_insurance_rate" className="text-sm text-muted-foreground">
                  BHXH
                </Label>
                <Input
                  id="social_insurance_rate"
                  type="number"
                  step="0.001"
                  {...register('social_insurance_rate')}
                />
                <p className="text-xs text-muted-foreground">VD: 0.08 = 8%</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="health_insurance_rate" className="text-sm text-muted-foreground">
                  BHYT
                </Label>
                <Input
                  id="health_insurance_rate"
                  type="number"
                  step="0.001"
                  {...register('health_insurance_rate')}
                />
                <p className="text-xs text-muted-foreground">VD: 0.015 = 1.5%</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unemployment_insurance_rate" className="text-sm text-muted-foreground">
                  BHTN
                </Label>
                <Input
                  id="unemployment_insurance_rate"
                  type="number"
                  step="0.001"
                  {...register('unemployment_insurance_rate')}
                />
                <p className="text-xs text-muted-foreground">VD: 0.01 = 1%</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea id="notes" {...register('notes')} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang lưu...' : editingConfig ? 'Cập Nhật' : 'Tạo Mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
