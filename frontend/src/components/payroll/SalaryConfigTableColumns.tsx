import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SalaryConfig } from '@/lib/api/salary-config';

interface SalaryConfigColumnsProps {
  onEdit: (config: SalaryConfig) => void;
  onDelete: (id: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
};

const salaryTypeLabels: Record<string, string> = {
  monthly: 'Theo tháng',
  daily: 'Theo ngày',
  hourly: 'Theo giờ',
};

export function createSalaryConfigColumns({
  onEdit,
  onDelete,
}: SalaryConfigColumnsProps): ColumnDef<SalaryConfig>[] {
  return [
    {
      accessorKey: 'user_profiles_employee_salary_configs_employee_idTouser_profiles.employee_code',
      header: 'Mã NV',
      cell: ({ row }) => {
        const employee = row.original.user_profiles_employee_salary_configs_employee_idTouser_profiles;
        return employee?.employee_code || '-';
      },
    },
    {
      accessorKey: 'user_profiles_employee_salary_configs_employee_idTouser_profiles.full_name',
      header: 'Nhân viên',
      cell: ({ row }) => {
        const employee = row.original.user_profiles_employee_salary_configs_employee_idTouser_profiles;
        return (
          <div>
            <div className="font-medium">{employee?.full_name || 'N/A'}</div>
            <div className="text-sm text-muted-foreground">{employee?.email}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'salary_type',
      header: 'Loại lương',
      cell: ({ row }) => {
        const type = row.getValue('salary_type') as string;
        return (
          <Badge variant="outline">
            {salaryTypeLabels[type] || type}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'base_salary',
      header: 'Lương cơ bản',
      cell: ({ row }) => {
        const value = row.getValue('base_salary') as number;
        return <span className="font-medium">{formatCurrency(value)}</span>;
      },
    },
    {
      accessorKey: 'standard_work_days_per_month',
      header: 'Ngày công chuẩn',
      cell: ({ row }) => row.getValue('standard_work_days_per_month') || 26,
    },
    {
      id: 'allowances',
      header: 'Phụ cấp',
      cell: ({ row }) => {
        const lunch = Number(row.original.lunch_allowance) || 0;
        const transport = Number(row.original.transport_allowance) || 0;
        const phone = Number(row.original.phone_allowance) || 0;
        const total = lunch + transport + phone;
        return formatCurrency(total);
      },
    },
    {
      id: 'insurance_rates',
      header: 'Bảo hiểm',
      cell: ({ row }) => {
        const si = Number(row.original.social_insurance_rate) || 0;
        const hi = Number(row.original.health_insurance_rate) || 0;
        const ui = Number(row.original.unemployment_insurance_rate) || 0;
        const total = ((si + hi + ui) * 100).toFixed(1);
        return `${total}%`;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const config = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Mở menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(config)}>
                <Pencil className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(config.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
