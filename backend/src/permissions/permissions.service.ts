import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  // ============ PERMISSIONS CRUD ============

  /**
   * Get all permissions
   */
  async getAllPermissions() {
    return this.prisma.permissions.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string) {
    return this.prisma.permissions.findMany({
      where: { resource },
      orderBy: { action: 'asc' },
    });
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(id: string) {
    const permission = await this.prisma.permissions.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    return permission;
  }

  // ============ ROLES CRUD ============

  /**
   * Get all roles
   */
  async getAllRoles() {
    return this.prisma.roles.findMany({
      include: {
        role_permissions: {
          include: {
            permissions: true,
          },
        },
        _count: {
          select: {
            user_roles: true,
            role_permissions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string) {
    const role = await this.prisma.roles.findUnique({
      where: { id },
      include: {
        role_permissions: {
          include: {
            permissions: true,
          },
        },
        user_roles: {
          include: {
            user_profiles_user_roles_user_idTouser_profiles: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  /**
   * Create a new role
   */
  async createRole(createRoleDto: CreateRoleDto) {
    // Check if role name already exists
    const existingRole = await this.prisma.roles.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists`,
      );
    }

    return this.prisma.roles.create({
      data: {
        name: createRoleDto.name,
        description: createRoleDto.description,
        is_system: createRoleDto.is_system || false,
      },
    });
  }

  /**
   * Update a role
   */
  async updateRole(id: string, updateRoleDto: UpdateRoleDto) {
    // Check if role exists
    const role = await this.prisma.roles.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // If updating name, check for conflicts
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.prisma.roles.findUnique({
        where: { name: updateRoleDto.name },
      });

      if (existingRole) {
        throw new ConflictException(
          `Role with name '${updateRoleDto.name}' already exists`,
        );
      }
    }

    return this.prisma.roles.update({
      where: { id },
      data: updateRoleDto,
    });
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string) {
    // Check if role exists
    const role = await this.prisma.roles.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Cannot delete system roles
    if (role.is_system) {
      throw new BadRequestException('Cannot delete system roles');
    }

    // Delete role (cascade will handle user_roles and role_permissions)
    return this.prisma.roles.delete({ where: { id } });
  }

  // ============ ROLE PERMISSIONS ============

  /**
   * Assign permissions to a role
   */
  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    // Verify role exists
    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Verify all permissions exist
    const permissions = await this.prisma.permissions.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Some permission IDs are invalid');
    }

    // Delete existing role permissions and create new ones
    await this.prisma.$transaction([
      this.prisma.role_permissions.deleteMany({
        where: { role_id: roleId },
      }),
      this.prisma.role_permissions.createMany({
        data: permissionIds.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  /**
   * Remove a permission from a role
   */
  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    const result = await this.prisma.role_permissions.deleteMany({
      where: {
        role_id: roleId,
        permission_id: permissionId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Role-permission association not found or already removed',
      );
    }
  }

  // ============ USER ROLES ============

  /**
   * Get all users with their roles
   */
  async getAllUsersWithRoles() {
    return this.prisma.user_profiles.findMany({
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        user_roles_user_roles_user_idTouser_profiles: {
          include: {
            roles: true,
          },
        },
      },
      orderBy: { full_name: 'asc' },
    });
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string) {
    const user = await this.prisma.user_profiles.findUnique({
      where: { id: userId },
      include: {
        user_roles_user_roles_user_idTouser_profiles: {
          include: {
            roles: {
              include: {
                role_permissions: {
                  include: {
                    permissions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.user_roles_user_roles_user_idTouser_profiles.map((ur) => ur.roles);
  }

  /**
   * Assign roles to a user
   */
  async assignRolesToUser(assignRoleDto: AssignRoleDto, assignedBy: string) {
    const { userId, roleIds } = assignRoleDto;

    // Verify user exists
    const user = await this.prisma.user_profiles.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify all roles exist
    const roles = await this.prisma.roles.findMany({
      where: { id: { in: roleIds } },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('Some role IDs are invalid');
    }

    // Delete existing user roles and create new ones
    await this.prisma.$transaction([
      this.prisma.user_roles.deleteMany({
        where: { user_id: userId },
      }),
      this.prisma.user_roles.createMany({
        data: roleIds.map((roleId) => ({
          user_id: userId,
          role_id: roleId,
          assigned_by: assignedBy,
        })),
        skipDuplicates: true,
      }),
    ]);

    return this.getUserRoles(userId);
  }

  /**
   * Remove a role from a user
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const result = await this.prisma.user_roles.deleteMany({
      where: {
        user_id: userId,
        role_id: roleId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'User-role association not found or already removed',
      );
    }
  }

  // ============ PERMISSION AUDIT ============

  /**
   * Log permission changes for audit
   */
  async logPermissionChange(
    userId: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    changes: any,
    performedBy: string,
  ) {
    return this.prisma.permission_audit_log.create({
      data: {
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        changes,
        performed_by: performedBy,
      },
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(limit: number = 100, offset: number = 0) {
    return this.prisma.permission_audit_log.findMany({
      include: {
        user_profiles_permission_audit_log_user_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_permission_audit_log_performed_byTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getAuditLogsForUser(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    return this.prisma.permission_audit_log.findMany({
      where: { user_id: userId },
      include: {
        user_profiles_permission_audit_log_performed_byTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  // ============ USER PERMISSIONS (ABAC) ============

  /**
   * Get user-specific permissions (not from roles)
   */
  async getUserPermissions(userId: string) {
    const user = await this.prisma.user_profiles.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.user_permissions.findMany({
      where: { user_id: userId },
      include: {
        permissions: true,
        user_profiles_user_permissions_assigned_byTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { assigned_at: 'desc' },
    });
  }

  /**
   * Assign specific permissions to a user (ABAC)
   * @param userId - User to assign permissions to
   * @param permissionIds - Array of permission IDs
   * @param granted - true to grant, false to deny (overrides role permissions)
   * @param assignedBy - ID of user performing the assignment
   */
  async assignPermissionsToUser(
    userId: string,
    permissionIds: string[],
    granted: boolean = true,
    assignedBy: string,
  ) {
    // Verify user exists
    const user = await this.prisma.user_profiles.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify all permissions exist
    const permissions = await this.prisma.permissions.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }

    // Use transaction to assign all permissions atomically
    const results = await this.prisma.$transaction(
      permissionIds.map((permissionId) =>
        this.prisma.user_permissions.upsert({
          where: {
            user_id_permission_id: {
              user_id: userId,
              permission_id: permissionId,
            },
          },
          create: {
            user_id: userId,
            permission_id: permissionId,
            granted,
            assigned_by: assignedBy,
          },
          update: {
            granted,
            assigned_by: assignedBy,
            assigned_at: new Date(),
          },
        }),
      ),
    );

    // Log the action
    await this.logPermissionChange(
      userId,
      granted ? 'grant_user_permission' : 'deny_user_permission',
      'user_permission',
      userId,
      {
        permissionIds,
        granted,
      },
      assignedBy,
    );

    return results;
  }

  /**
   * Remove a user-specific permission
   */
  async removePermissionFromUser(userId: string, permissionId: string) {
    const userPermission = await this.prisma.user_permissions.findUnique({
      where: {
        user_id_permission_id: {
          user_id: userId,
          permission_id: permissionId,
        },
      },
    });

    if (!userPermission) {
      throw new NotFoundException(
        `User permission not found for user ${userId} and permission ${permissionId}`,
      );
    }

    await this.prisma.user_permissions.delete({
      where: {
        user_id_permission_id: {
          user_id: userId,
          permission_id: permissionId,
        },
      },
    });

    return { message: 'User permission removed successfully' };
  }
}
