import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import type { UserProfile } from '../types';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { EmployeeFormDialog } from '@/components/employees/EmployeeFormDialog';
import { createEmployeeColumns } from '@/components/employees/EmployeeTableColumns';

interface EmployeeFormData {
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserProfile | null>(null);

  // Fetch employees with useQuery
  const { data: employeesData, isLoading, refetch } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response: any = await apiClient.users.getEmployees();
      return response || [];
    },
  });

  const employees: UserProfile[] = employeesData || [];

  const handleOpenDialog = (employee?: UserProfile) => {
    if (employee) {
      setEditingEmployee(employee);
    } else {
      setEditingEmployee(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (data: EmployeeFormData) => {
    try {
      if (!editingEmployee && !data.password) {
        throw new Error('Mật khẩu là bắt buộc cho nhân viên mới');
      }

      if (editingEmployee) {
        // Update existing employee
        const payload = {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          role: 'employee',
        };

        await apiClient.users.update(editingEmployee.id, payload);
      } else {
        // Create new employee with auth user
        const payload = {
          email: data.email,
          password: data.password!,
          full_name: data.full_name,
          phone: data.phone,
          role: 'employee',
        };

        await apiClient.users.create(payload);
      }

      handleCloseDialog();
      refetch();
    } catch (err: any) {
      throw new Error(err.message || 'Không thể lưu nhân viên');
    }
  };

  const handleToggleActive = async (employee: UserProfile) => {
    try {
      await apiClient.users.toggleActive(employee.id);
      refetch();
    } catch (err: any) {
      console.error('Error toggling employee status:', err);
    }
  };

  // Create table columns with callbacks
  const columns = createEmployeeColumns({
    onView: (employeeId) => navigate(`/employees/${employeeId}`),
    onEdit: (employee) => handleOpenDialog(employee),
    onToggleActive: handleToggleActive,
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nhân Viên</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Quản lý nhân viên xưởng và trạng thái của họ
        </p>
      </div>

      {/* Reusable DataTable Component */}
      <DataTable
        columns={columns}
        data={employees}
        isLoading={isLoading}
        searchColumn="full_name"
        searchPlaceholder="Lọc theo tên..."
        addButton={{
          label: 'Thêm Nhân Viên',
          onClick: () => handleOpenDialog(),
        }}
      />

      {/* Reusable Employee Form Dialog */}
      <EmployeeFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        editingEmployee={editingEmployee}
      />
    </div>
  );
}
