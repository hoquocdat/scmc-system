import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { BikeCell, CustomerCell } from '@/components/table/TableCells';
import { EmployeeProfileRow } from '@/components/shared/EmployeeProfileRow';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';

export interface ServiceOrderWithDetails {
  id: string;
  order_number: string;
  status: string;
  priority: string;
  bikes?: {
    license_plate: string;
    brand: string;
    model: string;
  };
  customers?: {
    full_name: string;
    phone: string;
  };
  user_profiles?: {
    id: string;
    full_name: string;
    role: string;
  };
}


export const createServiceOrderColumns = (
  onViewOrder: (orderId: string) => void
): ColumnDef<ServiceOrderWithDetails>[] => [
  {
    accessorKey: 'order_number',
    header: 'Số Lệnh',
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue('order_number')}</div>
    ),
  },
  {
    accessorKey: 'motorcycle',
    header: 'Xe',
    cell: ({ row }) => <BikeCell bike={row.original.bikes} />,
  },
  {
    accessorKey: 'customer',
    header: 'Khách Hàng',
    cell: ({ row }) => <CustomerCell customer={row.original.customers} />,
  },
  {
    accessorKey: 'status',
    header: 'Trạng Thái',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return <StatusBadge status={status} />;
    },
  },
  {
    accessorKey: 'priority',
    header: () => <div className="hidden sm:table-cell">Ưu Tiên</div>,
    cell: ({ row }) => {
      const priority = row.getValue('priority') as string;
      return (
        <div className="hidden sm:table-cell">
          <PriorityBadge priority={priority} />
        </div>
      );
    },
  },
  {
    accessorKey: 'employee',
    header: () => <div className="hidden md:table-cell">Nhân Viên</div>,
    cell: ({ row }) => {
      const order = row.original;
      return (
        <div className="hidden md:table-cell">
          {order.user_profiles ? (
            <EmployeeProfileRow
              fullName={order.user_profiles.full_name}
              role={order.user_profiles.role}
            />
          ) : (
            <span className="text-sm text-gray-400">Chưa phân công</span>
          )}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const order = row.original;
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewOrder(order.id)}
        >
          Xem
        </Button>
      );
    },
  },
];
