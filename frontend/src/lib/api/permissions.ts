import { apiClient } from './client';

// ============ TYPES ============

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  conditions: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  role_permissions?: {
    permissions: Permission;
  }[];
  _count?: {
    user_roles: number;
    role_permissions: number;
  };
}

export interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  role: string;
  user_roles: {
    roles: Role;
  }[];
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  is_system?: boolean;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  is_system?: boolean;
}

export interface AssignRoleDto {
  userId: string;
  roleIds: string[];
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  changes: Record<string, any>;
  performed_by: string;
  created_at: string;
  user_profiles_permission_audit_log_user_idTouser_profiles?: {
    id: string;
    name: string;
    email: string;
  };
  user_profiles_permission_audit_log_performed_byTouser_profiles?: {
    id: string;
    name: string;
    email: string;
  };
}

// ============ API FUNCTIONS ============

export const permissionsApi = {
  // Permissions
  getAllPermissions: async (): Promise<Permission[]> => {
    const response = await apiClient.get('/permissions');
    return response.data;
  },

  getPermissionsByResource: async (resource: string): Promise<Permission[]> => {
    const response = await apiClient.get(`/permissions/resource/${resource}`);
    return response.data;
  },

  getPermissionById: async (id: string): Promise<Permission> => {
    const response = await apiClient.get(`/permissions/${id}`);
    return response.data;
  },

  // Roles
  getAllRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get('/permissions/roles/all');
    return response.data;
  },

  getRoleById: async (id: string): Promise<Role> => {
    const response = await apiClient.get(`/permissions/roles/${id}`);
    return response.data;
  },

  createRole: async (data: CreateRoleDto): Promise<Role> => {
    const response = await apiClient.post('/permissions/roles', data);
    return response.data;
  },

  updateRole: async (id: string, data: UpdateRoleDto): Promise<Role> => {
    const response = await apiClient.put(`/permissions/roles/${id}`, data);
    return response.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await apiClient.delete(`/permissions/roles/${id}`);
  },

  // Role Permissions
  assignPermissionsToRole: async (
    roleId: string,
    permissionIds: string[],
  ): Promise<void> => {
    await apiClient.post(`/permissions/roles/${roleId}/permissions`, {
      permissionIds,
    });
  },

  removePermissionFromRole: async (
    roleId: string,
    permissionId: string,
  ): Promise<void> => {
    await apiClient.delete(
      `/permissions/roles/${roleId}/permissions/${permissionId}`,
    );
  },

  // User Roles
  getAllUsersWithRoles: async (): Promise<UserWithRoles[]> => {
    const response = await apiClient.get('/permissions/users/all-with-roles');
    return response.data;
  },

  getUserRoles: async (userId: string): Promise<Role[]> => {
    const response = await apiClient.get(`/permissions/users/${userId}/roles`);
    return response.data;
  },

  assignRolesToUser: async (data: AssignRoleDto): Promise<Role[]> => {
    const response = await apiClient.post('/permissions/users/assign-roles', data);
    return response.data;
  },

  removeRoleFromUser: async (userId: string, roleId: string): Promise<void> => {
    await apiClient.delete(`/permissions/users/${userId}/roles/${roleId}`);
  },

  // User Permissions (ABAC)
  getUserPermissions: async (userId: string) => {
    const response = await apiClient.get(`/permissions/users/${userId}/permissions`);
    return response.data;
  },

  assignPermissionsToUser: async (
    userId: string,
    permissionIds: string[],
    granted: boolean = true,
  ): Promise<void> => {
    await apiClient.post(`/permissions/users/${userId}/permissions`, {
      permissionIds,
      granted,
    });
  },

  removePermissionFromUser: async (
    userId: string,
    permissionId: string,
  ): Promise<void> => {
    await apiClient.delete(`/permissions/users/${userId}/permissions/${permissionId}`);
  },

  // Audit Logs
  getAuditLogs: async (limit = 100, offset = 0): Promise<AuditLog[]> => {
    const response = await apiClient.get('/permissions/audit/logs', {
      params: { limit, offset },
    });
    return response.data;
  },

  getAuditLogsForUser: async (
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<AuditLog[]> => {
    const response = await apiClient.get(`/permissions/audit/users/${userId}`, {
      params: { limit, offset },
    });
    return response.data;
  },
};
