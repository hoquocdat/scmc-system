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
import type { CreatePayrollPeriodDto } from '@/lib/api/payroll';

interface CreatePayrollPeriodDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePayrollPeriodDto) => Promise<void>;
  isLoading?: boolean;
}

interface FormData {
  period_year: number;
  period_month: number;
  period_name: string;
  confirmation_deadline: string;
  notes: string;
}

const months = [
  { value: 1, label: 'Tháng 1' },
  { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' },
  { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' },
  { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' },
  { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' },
  { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' },
  { value: 12, label: 'Tháng 12' },
];

export function CreatePayrollPeriodDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreatePayrollPeriodDialogProps) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      period_year: currentYear,
      period_month: currentMonth,
      period_name: '',
      confirmation_deadline: '',
      notes: '',
    },
  });

  const selectedYear = watch('period_year');
  const selectedMonth = watch('period_month');

  // Generate year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      period_year: data.period_year,
      period_month: data.period_month,
      period_name: data.period_name || undefined,
      confirmation_deadline: data.confirmation_deadline || undefined,
      notes: data.notes || undefined,
    });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo Kỳ Lương Mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Year and Month */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_year">Năm *</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => setValue('period_year', Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_month">Tháng *</Label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(value) => setValue('period_month', Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Period Name */}
          <div className="space-y-2">
            <Label htmlFor="period_name">Tên kỳ lương</Label>
            <Input
              id="period_name"
              {...register('period_name')}
              placeholder={`Lương Tháng ${selectedMonth}/${selectedYear}`}
            />
            <p className="text-xs text-muted-foreground">
              Để trống sẽ tự động tạo tên
            </p>
          </div>

          {/* Confirmation Deadline */}
          <div className="space-y-2">
            <Label htmlFor="confirmation_deadline">Hạn xác nhận</Label>
            <Input
              id="confirmation_deadline"
              type="date"
              {...register('confirmation_deadline')}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea id="notes" {...register('notes')} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang tạo...' : 'Tạo Kỳ Lương'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
