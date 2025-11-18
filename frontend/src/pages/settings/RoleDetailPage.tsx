import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Shield,
  Users,
  Lock,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
import { permissionsApi, type Permission, type Role } from '@/lib/api/permissions';
import { toast } from 'sonner';

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_system: false,
  });

  // Fetch role details
  const { data: role, isLoading: loadingRole } = useQuery<Role>({
    queryKey: ['role', id],
    queryFn: () => permissionsApi.getRoleById(id!),
    enabled: !!id,
  });

  // Initialize form data when role loads
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        is_system: role.is_system,
      });
      if (role.role_permissions) {
        setSelectedPermissions(
          new Set(role.role_permissions.map((rp: any) => rp.permissions.id))
        );
      }
    }
  }, [role]);

  // Fetch all permissions
  const { data: allPermissions, isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.getAllPermissions(),
  });

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    if (!allPermissions) return {};

    const filtered = allPermissions.filter(
      (p) =>
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())),
    );

    return filtered.reduce(
      (acc, permission) => {
        if (!acc[permission.resource]) {
          acc[permission.resource] = [];
        }
        acc[permission.resource].push(permission);
        return acc;
      },
      {} as Record<string, Permission[]>,
    );
  }, [allPermissions, searchQuery]);

  // Update role mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      permissionsApi.updateRole(id!, {
        name: formData.name,
        description: formData.description,
        is_system: formData.is_system,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật vai trò thành công');
      queryClient.invalidateQueries({ queryKey: ['role', id] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật vai trò');
    },
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissionIds: string[]) =>
      permissionsApi.assignPermissionsToRole(id!, permissionIds),
    onSuccess: () => {
      toast.success('Đã cập nhật quyền hạn thành công');
      queryClient.invalidateQueries({ queryKey: ['role', id] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật quyền hạn');
    },
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: () => permissionsApi.deleteRole(id!),
    onSuccess: () => {
      toast.success('Đã xóa vai trò thành công');
      navigate('/settings/roles');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể xóa vai trò');
    },
  });

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const handleToggleResource = (resource: string) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    const allSelected = resourcePermissions.every((p) => selectedPermissions.has(p.id));

    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      resourcePermissions.forEach((p) => {
        if (allSelected) {
          newSet.delete(p.id);
        } else {
          newSet.add(p.id);
        }
      });
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (allPermissions) {
      setSelectedPermissions(new Set(allPermissions.map((p) => p.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedPermissions(new Set());
  };

  const handleSavePermissions = () => {
    updatePermissionsMutation.mutate(Array.from(selectedPermissions));
  };

  const handleSaveRole = () => {
    updateMutation.mutate();
  };

  const handleCancelEdit = () => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        is_system: role.is_system,
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (role?.is_system) {
      toast.error('Không thể xóa vai trò hệ thống');
      return;
    }
    setShowDeleteDialog(true);
  };

  const isResourceFullySelected = (resource: string) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    return (
      resourcePermissions.length > 0 &&
      resourcePermissions.every((p) => selectedPermissions.has(p.id))
    );
  };

  const isResourcePartiallySelected = (resource: string) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    const selectedCount = resourcePermissions.filter((p) => selectedPermissions.has(p.id))
      .length;
    return selectedCount > 0 && selectedCount < resourcePermissions.length;
  };

  if (loadingRole || loadingPermissions) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Không tìm thấy vai trò</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings/roles')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
              <p className="text-muted-foreground">
                {role.description || 'Không có mô tả'}
              </p>
            </div>
            {role.is_system && (
              <Badge variant="secondary">Hệ thống</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={role.is_system}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="mr-2 h-4 w-4" />
                  Hủy
                </Button>
                <Button onClick={handleSaveRole} disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Lưu
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Role Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Thống kê</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Người dùng</span>
                </div>
                <span className="text-2xl font-bold">{role._count?.user_roles || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Quyền hạn</span>
                </div>
                <span className="text-2xl font-bold">{selectedPermissions.size}</span>
              </div>
            </CardContent>
          </Card>

          {/* Role Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Thông tin vai trò</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên vai trò</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!isEditing}
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Vai trò hệ thống</Label>
                  <p className="text-xs text-muted-foreground">
                    Không thể xóa vai trò hệ thống
                  </p>
                </div>
                <Switch
                  checked={formData.is_system}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_system: checked })
                  }
                  disabled={!isEditing || role.is_system}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Permissions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Quyền hạn</CardTitle>
                  <CardDescription>
                    {selectedPermissions.size} quyền đã chọn
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    Chọn tất cả
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                  >
                    Bỏ chọn
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePermissions}
                    disabled={updatePermissionsMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Lưu quyền
                  </Button>
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm quyền hạn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([resource, permissions]) => (
                    <div key={resource} className="space-y-2">
                      {/* Resource Header */}
                      <div
                        className="flex items-center gap-2 py-2 cursor-pointer hover:bg-accent rounded-md px-2"
                        onClick={() => handleToggleResource(resource)}
                      >
                        {isResourceFullySelected(resource) ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : isResourcePartiallySelected(resource) ? (
                          <Circle className="h-5 w-5 text-primary fill-primary/30" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <h4 className="font-medium text-sm">
                          {resource.replace(/_/g, ' ').toUpperCase()}
                        </h4>
                        <Badge variant="secondary" className="ml-auto">
                          {permissions.filter((p) => selectedPermissions.has(p.id)).length}/
                          {permissions.length}
                        </Badge>
                      </div>

                      {/* Permissions under this resource */}
                      <div className="ml-7 space-y-1">
                        {permissions.map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-start gap-2 py-2 px-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => handleTogglePermission(permission.id)}
                          >
                            <Checkbox
                              checked={selectedPermissions.has(permission.id)}
                              onCheckedChange={() => handleTogglePermission(permission.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{permission.name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {permission.action}
                                </Badge>
                              </div>
                              {permission.description && (
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Separator />
                    </div>
                  ))}

                  {Object.keys(groupedPermissions).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">
                        Không tìm thấy quyền hạn phù hợp
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa vai trò</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa vai trò "{role.name}"? Hành động này không thể hoàn tác.
              {role._count?.user_roles && role._count.user_roles > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Cảnh báo: Có {role._count.user_roles} người dùng đang sử dụng vai trò này.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive"
            >
              Xóa vai trò
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
