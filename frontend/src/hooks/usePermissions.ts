import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { permissionsApi } from '@/lib/api/permissions';
import { useAuthStore } from '@/store/authStore';

interface PermissionRef {
  resource: string;
  action: string;
}

/**
 * The signed-in user's permissions (roles plus individual grants), using the
 * same queries as the navigation so they are fetched once.
 */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const { data: roles = [] } = useQuery({ queryKey: ['my-roles'], queryFn: () => permissionsApi.getMyRoles(), enabled: !!user?.id });
  const { data: grants = [] } = useQuery({ queryKey: ['my-permissions'], queryFn: () => permissionsApi.getMyPermissions(), enabled: !!user?.id });

  const can = useCallback(
    (resource: string, action: string): boolean => {
      for (const up of grants as unknown as { granted?: boolean; permissions?: PermissionRef }[]) {
        if (up.permissions?.resource === resource && up.permissions.action === action) return up.granted === true;
      }
      for (const ur of roles as unknown as { role_permissions?: { permissions?: PermissionRef }[] }[]) {
        for (const rp of ur.role_permissions ?? []) {
          if (rp.permissions?.resource === resource && rp.permissions.action === action) return true;
        }
      }
      return false;
    },
    [roles, grants],
  );

  return { can };
}
