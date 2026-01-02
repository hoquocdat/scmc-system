import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaryConfigApi, type SalaryConfig, type CreateSalaryConfigDto, type UpdateSalaryConfigDto } from '@/lib/api/salary-config';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { SalaryConfigFormDialog } from '@/components/payroll/SalaryConfigFormDialog';
import { createSalaryConfigColumns } from '@/components/payroll/SalaryConfigTableColumns';
import { toast } from 'sonner';

export function SalaryConfigsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SalaryConfig | null>(null);
  const queryClient = useQueryClient();

  // Fetch salary configs
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['salary-configs'],
    queryFn: salaryConfigApi.getAll,
  });

  // Fetch employees without config (for create dialog)
  const { data: employeesWithoutConfig = [] } = useQuery({
    queryKey: ['employees-without-config'],
    queryFn: salaryConfigApi.getEmployeesWithoutConfig,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: salaryConfigApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-configs'] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-config'] });
      toast.success('Đã tạo cấu hình lương mới');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalaryConfigDto }) =>
      salaryConfigApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-configs'] });
      toast.success('Đã cập nhật cấu hình lương');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: salaryConfigApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-configs'] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-config'] });
      toast.success('Đã xóa cấu hình lương');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenDialog = () => {
    setEditingConfig(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (config: SalaryConfig) => {
    setEditingConfig(config);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingConfig(null);
  };

  const handleSubmit = async (data: CreateSalaryConfigDto | UpdateSalaryConfigDto) => {
    if (editingConfig) {
      await updateMutation.mutateAsync({ id: editingConfig.id, data: data as UpdateSalaryConfigDto });
    } else {
      await createMutation.mutateAsync(data as CreateSalaryConfigDto);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa cấu hình lương này?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const columns = createSalaryConfigColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cấu Hình Lương</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Quản lý cấu hình lương cho từng nhân viên
        </p>
      </div>

      <DataTable
        columns={columns}
        data={configs}
        isLoading={isLoading}
        searchColumn="user_profiles_employee_salary_configs_employee_idTouser_profiles.full_name"
        searchPlaceholder="Tìm theo tên nhân viên..."
        addButton={{
          label: 'Thêm Cấu Hình',
          onClick: handleOpenDialog,
        }}
      />

      <SalaryConfigFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        editingConfig={editingConfig}
        availableEmployees={employeesWithoutConfig}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
