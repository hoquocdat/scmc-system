import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, CheckCircle2, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { permissionsApi, type UserWithRoles } from '@/lib/api/permissions';
import { toast } from 'sonner';

interface UserRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles | { id: string; name: string; email: string };
}

export function UserRolesDialog({ open, onOpenChange, user }: UserRolesDialogProps) {
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  // Fetch all available roles
  const { data: allRoles, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => permissionsApi.getAllRoles(),
    enabled: open,
  });

  // Fetch user's current roles
  const { data: userRoles, isLoading: loadingUserRoles } = useQuery({
    queryKey: ['userRoles', user.id],
    queryFn: () => permissionsApi.getUserRoles(user.id),
    enabled: open,
  });

  // Initialize selected roles when user roles load
  useEffect(() => {
    if (userRoles) {
      setSelectedRoles(new Set(userRoles.map((role) => role.id)));
    }
  }, [userRoles]);

  // Assign roles mutation
  const assignRolesMutation = useMutation({
    mutationFn: (roleIds: string[]) =>
      permissionsApi.assignRolesToUser({
        userId: user.id,
        roleIds,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật vai trò thành công');
      queryClient.invalidateQueries({ queryKey: ['userRoles', user.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['usersWithRoles'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật vai trò');
    },
  });

  const handleToggleRole = (roleId: string) => {
    setSelectedRoles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (allRoles) {
      setSelectedRoles(new Set(allRoles.map((role) => role.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedRoles(new Set());
  };

  const handleSave = () => {
    const roleIds = Array.from(selectedRoles);
    if (roleIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một vai trò');
      return;
    }
    assignRolesMutation.mutate(roleIds);
  };

  const isLoading = loadingRoles || loadingUserRoles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Quản lý vai trò - {user.name}</DialogTitle>
          <DialogDescription>
            {user.email} • {selectedRoles.size} vai trò đã chọn
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={assignRolesMutation.isPending}
              >
                Chọn tất cả
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                disabled={assignRolesMutation.isPending}
              >
                Bỏ chọn
              </Button>
            </div>

            {/* Roles List */}
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-2">
                {allRoles?.map((role) => {
                  const isSelected = selectedRoles.has(role.id);
                  const permissionCount = role._count?.role_permissions || 0;

                  return (
                    <div key={role.id}>
                      <div
                        className="flex items-start gap-3 p-3 rounded-md hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => handleToggleRole(role.id)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleRole(role.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">{role.name}</p>
                              {role.is_system && (
                                <Badge variant="secondary" className="text-xs">
                                  Hệ thống
                                </Badge>
                              )}
                            </div>
                            {role.description && (
                              <p className="text-sm text-muted-foreground ml-6">
                                {role.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 ml-6 text-xs text-muted-foreground">
                              <span>{permissionCount} quyền hạn</span>
                              {role._count?.user_roles !== undefined && (
                                <span>
                                  {role._count.user_roles} người dùng
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Separator className="my-2" />
                    </div>
                  );
                })}

                {allRoles?.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Chưa có vai trò nào trong hệ thống
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Selected Roles Summary */}
            {selectedRoles.size > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-medium mb-2">Vai trò đã chọn:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedRoles)
                    .map((roleId) => allRoles?.find((r) => r.id === roleId))
                    .filter(Boolean)
                    .map((role) => (
                      <Badge key={role!.id} variant="default">
                        {role!.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={assignRolesMutation.isPending}
              >
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={assignRolesMutation.isPending}>
                {assignRolesMutation.isPending ? (
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
