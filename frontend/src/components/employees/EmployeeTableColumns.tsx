import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/types';

interface EmployeeTableColumnsProps {
  onView: (employeeId: string) => void;
  onEdit: (employee: UserProfile) => void;
  onToggleActive: (employee: UserProfile) => void;
}

export function createEmployeeColumns({
  onView,
  onEdit,
  onToggleActive,
}: EmployeeTableColumnsProps): ColumnDef<UserProfile>[] {
  const roleColors: Record<string, string> = {
    technician: 'bg-blue-100 text-blue-800',
    sales: 'bg-green-100 text-green-800',
    manager: 'bg-purple-100 text-purple-800',
    finance: 'bg-amber-100 text-amber-800',
  };

  const roleLabels: Record<string, string> = {
    technician: 'Kỹ Thuật Viên',
    sales: 'Nhân Viên Bán Hàng',
    manager: 'Quản Lý',
    finance: 'Kế Toán',
  };

  return [
    {
      accessorKey: 'full_name',
      header: 'Họ Tên',
      cell: ({ row }) => <div className="font-medium">{row.getValue('full_name')}</div>,
    },
    {
      accessorKey: 'email',
      header: () => <div className="hidden md:table-cell">Email</div>,
      cell: ({ row }) => <div className="hidden md:table-cell">{row.getValue('email') || '-'}</div>,
    },
    {
      accessorKey: 'phone',
      header: () => <div className="hidden sm:table-cell">Số Điện Thoại</div>,
      cell: ({ row }) => <div className="hidden sm:table-cell">{row.getValue('phone') || '-'}</div>,
    },
    {
      accessorKey: 'role',
      header: () => <div className="hidden sm:table-cell">Vai Trò</div>,
      cell: ({ row }) => {
        const role = row.getValue('role') as string;
        return (
          <div className="hidden sm:table-cell">
            <Badge className={roleColors[role] || 'bg-gray-100 text-gray-800'}>
              {roleLabels[role] || role}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Trạng Thái',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean;
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Hoạt Động' : 'Ngừng Hoạt Động'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(employee.id)}
            >
              Xem
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(employee)}
            >
              Sửa
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleActive(employee)}
            >
              {employee.is_active ? 'Vô Hiệu Hóa' : 'Kích Hoạt'}
            </Button>
          </div>
        );
      },
    },
  ];
}
