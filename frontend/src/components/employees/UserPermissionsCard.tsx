import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, X, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { permissionsApi, type Permission } from '@/lib/api/permissions';
import { toast } from 'sonner';
import {
  getPermissionFriendlyName,
  getResourceFriendlyName,
  getActionFriendlyName,
} from '@/lib/utils/permissions';

interface UserPermissionsCardProps {
  userId: string;
}

export function UserPermissionsCard({ userId }: UserPermissionsCardProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [isAddingPermissions, setIsAddingPermissions] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [grantMode, setGrantMode] = useState<boolean>(true); // true = grant, false = deny

  // Fetch all permissions
  const { data: allPermissions = [] } = useQuery<Permission[]>({
    queryKey: ['all-permissions'],
    queryFn: permissionsApi.getAllPermissions,
  });

  // Fetch user-specific permissions
  const { data: userPermissions = [], isLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => permissionsApi.getUserPermissions(userId),
  });

  // Assign permissions mutation
  const assignMutation = useMutation({
    mutationFn: async ({ permissionIds, granted }: { permissionIds: string[]; granted: boolean }) => {
      await permissionsApi.assignPermissionsToUser(userId, permissionIds, granted);
    },
    onSuccess: () => {
      toast.success('Quyền đã được cập nhật thành công');
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
      setIsAddingPermissions(false);
      setSelectedPermissions(new Set());
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể cập nhật quyền');
    },
  });

  // Remove permission mutation
  const removeMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      await permissionsApi.removePermissionFromUser(userId, permissionId);
    },
    onSuccess: () => {
      toast.success('Đã xóa quyền');
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể xóa quyền');
    },
  });

  // Get unique resources for filter
  const resources = useMemo(() => {
    const uniqueResources = new Set(allPermissions.map(p => p.resource));
    return ['all', ...Array.from(uniqueResources).sort()];
  }, [allPermissions]);

  // Filter permissions that user doesn't have yet
  const availablePermissions = useMemo(() => {
    const userPermissionIds = new Set(userPermissions.map((up: any) => up.permission_id));
    return allPermissions.filter(p => !userPermissionIds.has(p.id));
  }, [allPermissions, userPermissions]);

  // Filter by search and resource
  const filteredAvailablePermissions = useMemo(() => {
    return availablePermissions.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.resource.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesResource = selectedResource === 'all' || p.resource === selectedResource;
      return matchesSearch && matchesResource;
    });
  }, [availablePermissions, searchQuery, selectedResource]);

  const handleTogglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleAssignPermissions = () => {
    if (selectedPermissions.size === 0) {
      toast.error('Vui lòng chọn ít nhất một quyền');
      return;
    }
    assignMutation.mutate({
      permissionIds: Array.from(selectedPermissions),
      granted: grantMode,
    });
  };

  const groupedUserPermissions = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    userPermissions.forEach((up: any) => {
      const resource = up.permissions.resource;
      if (!grouped[resource]) grouped[resource] = [];
      grouped[resource].push(up);
    });
    return grouped;
  }, [userPermissions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Quyền Tùy Chỉnh (ABAC)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Quyền Tùy Chỉnh (ABAC)
            </CardTitle>
            <CardDescription>
              Quyền riêng cho người dùng này (ghi đè quyền từ vai trò)
            </CardDescription>
          </div>
          {!isAddingPermissions && (
            <Button onClick={() => setIsAddingPermissions(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Thêm Quyền
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAddingPermissions ? (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Thêm quyền tùy chỉnh</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddingPermissions(false);
                  setSelectedPermissions(new Set());
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Select value={grantMode ? 'grant' : 'deny'} onValueChange={(v) => setGrantMode(v === 'grant')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grant">✓ Cấp quyền</SelectItem>
                  <SelectItem value="deny">✗ Từ chối</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedResource} onValueChange={setSelectedResource}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Lọc theo tài nguyên" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource === 'all' ? 'Tất cả' : resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm quyền..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-2">
                {filteredAvailablePermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-start space-x-2 p-2 rounded hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedPermissions.has(permission.id)}
                      onCheckedChange={() => handleTogglePermission(permission.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getResourceFriendlyName(permission.resource)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getActionFriendlyName(permission.action)}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">{permission.description || getPermissionFriendlyName(permission.resource, permission.action)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingPermissions(false);
                  setSelectedPermissions(new Set());
                }}
              >
                Hủy
              </Button>
              <Button
                onClick={handleAssignPermissions}
                disabled={assignMutation.isPending || selectedPermissions.size === 0}
              >
                {assignMutation.isPending ? 'Đang lưu...' : `Thêm ${selectedPermissions.size} quyền`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {userPermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Người dùng này chưa có quyền tùy chỉnh nào. Quyền của họ đến từ vai trò được gán.
              </p>
            ) : (
              Object.entries(groupedUserPermissions).map(([resource, permissions]) => (
                <div key={resource} className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">{getResourceFriendlyName(resource)}</h4>
                  <div className="space-y-2">
                    {permissions.map((up: any) => (
                      <div
                        key={up.permission_id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div className="flex items-center gap-2">
                          {up.granted ? (
                            <Badge className="bg-green-500">✓ Cấp</Badge>
                          ) : (
                            <Badge variant="destructive">✗ Từ chối</Badge>
                          )}
                          <Badge variant="secondary">{getActionFriendlyName(up.permissions.action)}</Badge>
                          <span className="text-sm">
                            {up.permissions.description || getPermissionFriendlyName(up.permissions.resource, up.permissions.action)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMutation.mutate(up.permission_id)}
                          disabled={removeMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
