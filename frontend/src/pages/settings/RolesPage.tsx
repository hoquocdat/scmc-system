import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Shield, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { permissionsApi, type Role } from '@/lib/api/permissions';
import { toast } from 'sonner';
import { RoleFormDialog } from '@/components/permissions/RoleFormDialog';

export function RolesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // Fetch roles
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => permissionsApi.getAllRoles(),
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => permissionsApi.deleteRole(id),
    onSuccess: () => {
      toast.success('Đã xóa vai trò thành công');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeletingRole(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể xóa vai trò');
    },
  });

  const handleEdit = (role: Role) => {
    setEditingRole(role);
  };

  const handleDelete = (role: Role) => {
    if (role.is_system) {
      toast.error('Không thể xóa vai trò hệ thống');
      return;
    }
    setDeletingRole(role);
  };

  const confirmDelete = () => {
    if (deletingRole) {
      deleteMutation.mutate(deletingRole.id);
    }
  };

  const handleViewDetails = (role: Role) => {
    navigate(`/settings/roles/${role.id}`);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quản lý vai trò</h1>
            <p className="text-muted-foreground">
              Tạo và quản lý các vai trò với quyền hạn tùy chỉnh
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo vai trò mới
          </Button>
        </div>
      </div>

      {/* Roles Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vai trò</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead className="text-center">Người dùng</TableHead>
              <TableHead className="text-center">Quyền hạn</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles && roles.length > 0 ? (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="font-medium">{role.name}</span>
                      {role.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          Hệ thống
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {role.description || 'Không có mô tả'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">
                      {role._count?.user_roles || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">
                      {role._count?.role_permissions || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(role)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Xem chi tiết
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(role)}
                        disabled={role.is_system}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center">
                    <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chưa có vai trò nào</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Tạo vai trò đầu tiên để bắt đầu quản lý quyền hạn
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Tạo vai trò mới
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <RoleFormDialog
        open={isCreateDialogOpen || !!editingRole}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingRole(null);
          }
        }}
        role={editingRole}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa vai trò</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa vai trò "{deletingRole?.name}"? Hành động này không
              thể hoàn tác.
              {deletingRole?._count?.user_roles && deletingRole._count.user_roles > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Cảnh báo: Có {deletingRole._count.user_roles} người dùng đang sử dụng vai
                  trò này.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              Xóa vai trò
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
