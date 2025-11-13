import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, CheckCircle2, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { permissionsApi, type Role, type Permission } from '@/lib/api/permissions';
import { toast } from 'sonner';

interface RolePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}

export function RolePermissionsDialog({
  open,
  onOpenChange,
  role,
}: RolePermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Fetch all permissions
  const { data: allPermissions, isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.getAllPermissions(),
    enabled: open,
  });

  // Fetch role details with permissions
  const { data: roleDetails, isLoading: loadingRole } = useQuery({
    queryKey: ['role', role.id],
    queryFn: () => permissionsApi.getRoleById(role.id),
    enabled: open,
  });

  // Initialize selected permissions when role details load
  useEffect(() => {
    if (roleDetails?.role_permissions) {
      const permissionIds = roleDetails.role_permissions.map((rp) => rp.permissions.id);
      setSelectedPermissions(new Set(permissionIds));
    }
  }, [roleDetails]);

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

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissionIds: string[]) =>
      permissionsApi.assignPermissionsToRole(role.id, permissionIds),
    onSuccess: () => {
      toast.success('Đã cập nhật quyền hạn thành công');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', role.id] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật quyền hạn');
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

  const handleSave = () => {
    updatePermissionsMutation.mutate(Array.from(selectedPermissions));
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

  const isLoading = loadingPermissions || loadingRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Quản lý quyền hạn - {role.name}</DialogTitle>
          <DialogDescription>
            Chọn các quyền hạn cho vai trò này. {selectedPermissions.size} quyền đã chọn.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Search and Actions */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm quyền hạn..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={updatePermissionsMutation.isPending}
                >
                  Chọn tất cả
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={updatePermissionsMutation.isPending}
                >
                  Bỏ chọn
                </Button>
              </div>

              {/* Permissions List */}
              <ScrollArea className="h-[400px] rounded-md border">
                <div className="p-4 space-y-4">
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
            </div>

            {/* Footer Actions */}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updatePermissionsMutation.isPending}
              >
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={updatePermissionsMutation.isPending}>
                {updatePermissionsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  'Lưu thay đổi'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
