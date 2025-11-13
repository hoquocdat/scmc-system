import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Trash2, Edit2, X, Shield, User, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { apiClient } from '@/lib/api-client';
import { permissionsApi, type Role } from '@/lib/api/permissions';
import { UserPermissionsCard } from '@/components/employees/UserPermissionsCard';
import { PermissionsMatrixTab } from '@/components/employees/PermissionsMatrixTab';
import { toast } from 'sonner';
import type { UserProfile } from '@/types';

export function EmployeeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [hasRoleChanges, setHasRoleChanges] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  // Fetch employee details
  const { data: employee, isLoading: isLoadingEmployee } = useQuery<UserProfile>({
    queryKey: ['employee', id],
    queryFn: () => apiClient.users.getOne(id!),
    enabled: !!id,
  });

  // Fetch all roles
  const { data: allRoles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => permissionsApi.getAllRoles(),
  });

  // Fetch employee's current roles
  const { data: employeeRoles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['employee-roles', id],
    queryFn: async () => {
      const users = await permissionsApi.getAllUsersWithRoles();
      const user = users.find((u) => u.id === id);
      return user?.user_roles?.map((ur) => ur.role) || [];
    },
    enabled: !!id,
  });

  // Initialize form data when employee loads
  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
      });
    }
  }, [employee]);

  // Initialize selected roles when employee roles load
  useEffect(() => {
    if (employeeRoles.length > 0) {
      setSelectedRoles(new Set(employeeRoles.map((r) => r.id)));
    }
  }, [employeeRoles]);

  // Update employee mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => apiClient.users.update(id!, data),
    onSuccess: () => {
      toast.success('Đã cập nhật thông tin nhân viên');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể cập nhật nhân viên');
    },
  });

  // Delete employee mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.users.toggleActive(id!),
    onSuccess: () => {
      toast.success('Đã vô hiệu hóa nhân viên');
      navigate('/employees');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể vô hiệu hóa nhân viên');
    },
  });

  // Assign roles mutation
  const assignRolesMutation = useMutation({
    mutationFn: async (roleIds: string[]) => {
      await permissionsApi.assignRolesToUser({ userId: id!, roleIds });
    },
    onSuccess: () => {
      toast.success('Đã cập nhật vai trò thành công');
      queryClient.invalidateQueries({ queryKey: ['employee-roles', id] });
      setHasRoleChanges(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể cập nhật vai trò');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
  };

  const handleRoleToggle = (roleId: string) => {
    const newSelected = new Set(selectedRoles);
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId);
    } else {
      newSelected.add(roleId);
    }
    setSelectedRoles(newSelected);
    setHasRoleChanges(true);
  };

  const handleSaveRoles = () => {
    assignRolesMutation.mutate(Array.from(selectedRoles));
  };

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      await apiClient.users.updatePassword(id!, password);
    },
    onSuccess: () => {
      toast.success('Đã cập nhật mật khẩu thành công');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể cập nhật mật khẩu');
    },
  });

  const handleUpdatePassword = () => {
    if (!newPassword) {
      toast.error('Vui lòng nhập mật khẩu mới');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    updatePasswordMutation.mutate(newPassword);
  };

  if (isLoadingEmployee || isLoadingRoles) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Không tìm thấy nhân viên</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa nhân viên</h1>
            <p className="text-muted-foreground">
              Cập nhật thông tin và quản lý vai trò
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Vô hiệu hóa
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Employee Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin tổng quan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trạng thái</span>
                <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                  {employee.is_active ? 'Đang hoạt động' : 'Vô hiệu hóa'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Số vai trò</span>
                <span className="text-lg font-semibold">{employeeRoles.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vai trò cũ</span>
                <Badge variant="outline">{employee.role}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Employee Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thông tin cá nhân</CardTitle>
              <CardDescription>
                {isEditing ? 'Chỉnh sửa thông tin nhân viên' : 'Thông tin chi tiết'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Họ và tên</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Chưa có"
                />
              </div>
            </CardContent>
          </Card>

          {/* Password Reset Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Đặt lại mật khẩu
              </CardTitle>
              <CardDescription>
                Cập nhật mật khẩu đăng nhập cho nhân viên
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">Mật khẩu mới</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Xác nhận mật khẩu</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <Button
                onClick={handleUpdatePassword}
                disabled={updatePasswordMutation.isPending || !newPassword || !confirmPassword}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {updatePasswordMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="roles" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="roles">Vai trò</TabsTrigger>
              <TabsTrigger value="matrix">Ma trận quyền</TabsTrigger>
              <TabsTrigger value="custom">Quyền tùy chỉnh</TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Quản lý vai trò
                      </CardTitle>
                      <CardDescription>
                        Chọn các vai trò cho nhân viên này
                      </CardDescription>
                    </div>
                    {hasRoleChanges && (
                      <Button onClick={handleSaveRoles} disabled={assignRolesMutation.isPending}>
                        <Save className="mr-2 h-4 w-4" />
                        {assignRolesMutation.isPending ? 'Đang lưu...' : 'Lưu vai trò'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {hasRoleChanges && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        Bạn có thay đổi chưa lưu. Nhấn "Lưu vai trò" để áp dụng.
                      </p>
                    </div>
                  )}

                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {allRoles.map((role) => {
                        const isSelected = selectedRoles.has(role.id);
                        const permissionCount = role._count?.role_permissions || 0;
                        const userCount = role._count?.user_roles || 0;

                        return (
                          <div
                            key={role.id}
                            className={`flex items-start space-x-3 p-4 rounded-lg border ${
                              isSelected ? 'border-primary bg-primary/5' : 'border-border'
                            } hover:border-primary/50 transition-colors cursor-pointer`}
                            onClick={() => handleRoleToggle(role.id)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleRoleToggle(role.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <span className="font-medium">{role.name}</span>
                                {role.is_system && (
                                  <Badge variant="secondary" className="text-xs">
                                    Hệ thống
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {role.description || 'Không có mô tả'}
                              </p>
                              <div className="flex gap-4 mt-2">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Shield className="h-3 w-3" />
                                  <span>{permissionCount} quyền</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{userCount} người dùng</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {selectedRoles.size > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">
                        Đã chọn {selectedRoles.size} vai trò:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(selectedRoles).map((roleId) => {
                          const role = allRoles.find((r) => r.id === roleId);
                          return role ? (
                            <Badge key={roleId} variant="secondary">
                              {role.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Permissions Matrix Tab */}
            <TabsContent value="matrix" className="mt-6">
              <PermissionsMatrixTab userId={id!} />
            </TabsContent>

            {/* Custom Permissions Tab */}
            <TabsContent value="custom" className="mt-6">
              <UserPermissionsCard userId={id!} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận vô hiệu hóa nhân viên</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn vô hiệu hóa nhân viên "{employee.full_name}"? Họ sẽ không thể đăng nhập vào hệ thống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Vô hiệu hóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
