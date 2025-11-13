import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { permissionsApi, type Permission } from '@/lib/api/permissions';
import {
  getResourceFriendlyName,
  getActionFriendlyName,
} from '@/lib/utils/permissions';
import { toast } from 'sonner';

interface PermissionsMatrixTabProps {
  userId: string;
}

interface PermissionCell {
  permission: Permission;
  fromRoles: string[];
  userOverride: 'grant' | 'deny' | null;
  finalStatus: boolean;
}

export function PermissionsMatrixTab({ userId }: PermissionsMatrixTabProps) {
  const queryClient = useQueryClient();

  // Fetch user roles
  const { data: userRoles = [] } = useQuery({
    queryKey: ['employee-roles', userId],
    queryFn: () => permissionsApi.getUserRoles(userId),
  });

  // Fetch user-specific permissions
  const { data: userPermissions = [] } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => permissionsApi.getUserPermissions(userId),
  });

  // Fetch all permissions
  const { data: allPermissions = [] } = useQuery<Permission[]>({
    queryKey: ['all-permissions'],
    queryFn: permissionsApi.getAllPermissions,
  });

  // Mutation to toggle permission
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ permissionId, granted }: { permissionId: string; granted: boolean }) => {
      if (!granted) {
        // If turning off, remove the permission
        await permissionsApi.removePermissionFromUser(userId, permissionId);
      } else {
        // If turning on, grant the permission
        await permissionsApi.assignPermissionsToUser(userId, [permissionId], true);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
      queryClient.invalidateQueries({ queryKey: ['employee-roles', userId] });
      toast.success('Quyền đã được cập nhật');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật quyền');
    },
  });

  // Build permission map: resource -> action -> PermissionCell
  const permissionMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, PermissionCell>>();

    // First, initialize matrix with all permissions
    allPermissions.forEach((permission) => {
      if (!matrix.has(permission.resource)) {
        matrix.set(permission.resource, new Map());
      }
      matrix.get(permission.resource)!.set(permission.action, {
        permission,
        fromRoles: [],
        userOverride: null,
        finalStatus: false,
      });
    });

    // Collect permissions from roles
    userRoles.forEach((role: any) => {
      role.role_permissions?.forEach((rp: any) => {
        const permission = rp.permissions;
        const resourceMap = matrix.get(permission.resource);
        if (resourceMap) {
          const cell = resourceMap.get(permission.action);
          if (cell) {
            cell.fromRoles.push(role.name);
            cell.finalStatus = true;
          }
        }
      });
    });

    // Apply user-specific permissions
    userPermissions.forEach((up: any) => {
      const permission = up.permissions;
      const resourceMap = matrix.get(permission.resource);
      if (resourceMap) {
        const cell = resourceMap.get(permission.action);
        if (cell) {
          cell.userOverride = up.granted ? 'grant' : 'deny';
          cell.finalStatus = up.granted;
        }
      }
    });

    return matrix;
  }, [allPermissions, userRoles, userPermissions]);

  // Get all unique actions sorted
  const allActions = useMemo(() => {
    const actions = new Set<string>();
    allPermissions.forEach((p) => actions.add(p.action));
    return Array.from(actions).sort();
  }, [allPermissions]);

  // Get all resources sorted
  const allResources = useMemo(() => {
    return Array.from(permissionMatrix.keys()).sort();
  }, [permissionMatrix]);

  const handleToggle = async (resource: string, action: string, currentStatus: boolean) => {
    const cell = permissionMatrix.get(resource)?.get(action);
    if (!cell) return;

    togglePermissionMutation.mutate({
      permissionId: cell.permission.id,
      granted: !currentStatus,
    });
  };

  // Stats
  const stats = useMemo(() => {
    let total = 0;
    let fromRoles = 0;
    let customGrants = 0;
    let denials = 0;

    permissionMatrix.forEach((resourceMap) => {
      resourceMap.forEach((cell) => {
        if (cell.finalStatus) total++;
        if (cell.fromRoles.length > 0) fromRoles++;
        if (cell.fromRoles.length === 0 && cell.userOverride === 'grant') customGrants++;
        if (cell.userOverride === 'deny') denials++;
      });
    });

    return { total, fromRoles, customGrants, denials };
  }, [permissionMatrix]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Tổng quyền</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Từ vai trò</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.fromRoles}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Tùy chỉnh cấp</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.customGrants}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Từ chối</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.denials}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Chú giải</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-10 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              <span>Được cấp (bật)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-6 bg-gray-300 rounded-full flex items-center px-1">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              <span>Không có quyền (tắt)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5">Vai trò</Badge>
              <span>Từ vai trò</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="h-5 bg-blue-500">Tùy chỉnh</Badge>
              <span>Tùy chỉnh</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Ma trận quyền hạn
          </CardTitle>
          <CardDescription>
            Bật/tắt quyền cho từng tài nguyên và hành động
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] sticky left-0 bg-background z-10">
                      Tài nguyên
                    </TableHead>
                    {allActions.map((action) => (
                      <TableHead key={action} className="text-center min-w-[120px]">
                        {getActionFriendlyName(action)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allResources.map((resource) => {
                    const resourceMap = permissionMatrix.get(resource)!;
                    return (
                      <TableRow key={resource}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">
                          {getResourceFriendlyName(resource)}
                        </TableCell>
                        {allActions.map((action) => {
                          const cell = resourceMap.get(action);
                          if (!cell) {
                            return <TableCell key={action} className="text-center">-</TableCell>;
                          }

                          const tooltipContent = (
                            <div className="text-xs space-y-1">
                              <div className="font-semibold">
                                {getResourceFriendlyName(resource)} - {getActionFriendlyName(action)}
                              </div>
                              {cell.fromRoles.length > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Từ vai trò:</span>{' '}
                                  {cell.fromRoles.join(', ')}
                                </div>
                              )}
                              {cell.userOverride && (
                                <div>
                                  <span className="text-muted-foreground">Tùy chỉnh:</span>{' '}
                                  {cell.userOverride === 'grant' ? 'Cấp' : 'Từ chối'}
                                </div>
                              )}
                              {!cell.fromRoles.length && !cell.userOverride && (
                                <div className="text-muted-foreground">Chưa được cấp</div>
                              )}
                            </div>
                          );

                          return (
                            <TableCell key={action} className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Switch
                                        checked={cell.finalStatus}
                                        onCheckedChange={() =>
                                          handleToggle(resource, action, cell.finalStatus)
                                        }
                                        disabled={togglePermissionMutation.isPending}
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{tooltipContent}</TooltipContent>
                                </Tooltip>
                                {cell.fromRoles.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    R
                                  </Badge>
                                )}
                                {cell.userOverride && (
                                  <Badge className="text-xs bg-blue-500">C</Badge>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
