import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { PayrollSlipStatusBadge } from './PayrollPeriodStatusBadge';
import type { PayrollSlip } from '@/lib/api/payroll';

interface PayrollSlipColumnsProps {
  onView: (slip: PayrollSlip) => void;
}

const formatCurrency = (value: number | undefined | null) => {
  if (!value) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
};

export function createPayrollSlipColumns({
  onView,
}: PayrollSlipColumnsProps): ColumnDef<PayrollSlip>[] {
  return [
    {
      accessorKey: 'user_profiles_payroll_slips_employee_idTouser_profiles.employee_code',
      header: 'Mã NV',
      cell: ({ row }) => {
        const employee = row.original.user_profiles_payroll_slips_employee_idTouser_profiles;
        return employee?.employee_code || '-';
      },
    },
    {
      accessorKey: 'user_profiles_payroll_slips_employee_idTouser_profiles.full_name',
      header: 'Nhân viên',
      cell: ({ row }) => {
        const employee = row.original.user_profiles_payroll_slips_employee_idTouser_profiles;
        return (
          <div>
            <div className="font-medium">{employee?.full_name || 'N/A'}</div>
            <div className="text-sm text-muted-foreground">{employee?.email}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <PayrollSlipStatusBadge status={row.getValue('status')} />
      ),
    },
    {
      accessorKey: 'total_work_days',
      header: 'Ngày công',
      cell: ({ row }) => {
        const value = row.getValue('total_work_days') as number;
        return value?.toFixed(1) || '0';
      },
    },
    {
      accessorKey: 'base_salary_amount',
      header: 'Lương cơ bản',
      cell: ({ row }) => formatCurrency(row.getValue('base_salary_amount')),
    },
    {
      accessorKey: 'allowances_amount',
      header: 'Phụ cấp',
      cell: ({ row }) => formatCurrency(row.getValue('allowances_amount')),
    },
    {
      accessorKey: 'overtime_earnings',
      header: 'Tăng ca',
      cell: ({ row }) => formatCurrency(row.getValue('overtime_earnings')),
    },
    {
      accessorKey: 'total_deductions',
      header: 'Khấu trừ',
      cell: ({ row }) => {
        const value = row.getValue('total_deductions') as number;
        return (
          <span className="text-red-600">-{formatCurrency(value)}</span>
        );
      },
    },
    {
      accessorKey: 'net_pay',
      header: 'Thực lãnh',
      cell: ({ row }) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(row.getValue('net_pay'))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const slip = row.original;

        return (
          <Button variant="ghost" size="sm" onClick={() => onView(slip)}>
            <Eye className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];
}
