import { Injectable } from '@nestjs/common';
import {
  Ability,
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { PrismaService } from '../prisma/prisma.service';

// Define all possible actions
export enum Action {
  Manage = 'manage', // Special action that represents "any action"
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  // Specific actions for different resources
  Assign = 'assign',
  Approve = 'approve',
  Void = 'void',
  Refund = 'refund',
  Adjust = 'adjust',
  Transfer = 'transfer',
  Grant = 'grant',
  Revoke = 'revoke',
  Export = 'export',
  // Report-specific actions
  Sales = 'sales',
  Inventory = 'inventory',
  Financial = 'financial',
  Service = 'service',
}

// Define all possible subjects (resources)
export type Subjects =
  | 'products'
  | 'product_categories'
  | 'brands'
  | 'suppliers'
  | 'inventory'
  | 'stock_adjustments'
  | 'pos'
  | 'sales'
  | 'service_orders'
  | 'service_items'
  | 'customers'
  | 'bike_owners'
  | 'bikes'
  | 'payments'
  | 'reports'
  | 'users'
  | 'permissions'
  | 'roles'
  | 'settings'
  | 'all'; // Special subject that represents "any subject"

export type AppAbility = Ability<[Action, Subjects]>;

export interface PermissionConditions {
  [key: string]: any;
}

@Injectable()
export class CaslAbilityFactory {
  constructor(private prisma: PrismaService) {}

  /**
   * Create ability for a user based on their permissions
   * @param userId - The user's ID
   * @returns Promise<AppAbility> - The user's ability instance
   */
  async createForUser(userId: string): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    // Fetch user with their roles and permissions
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
        // Include user-specific permissions
        user_permissions_user_permissions_user_idTouser_profiles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      // User not found - return ability with no permissions
      return build();
    }

    // Collect all permissions from all roles
    const permissions = new Map<string, any>();

    for (const userRole of user.user_roles_user_roles_user_idTouser_profiles) {
      const role = userRole.roles;

      for (const rolePermission of role.role_permissions) {
        const permission = rolePermission.permissions;

        // Use permission name as key to avoid duplicates
        if (!permissions.has(permission.name)) {
          permissions.set(permission.name, {
            ...permission,
            granted: true, // Role permissions are always granted
          });
        }
      }
    }

    // Process user-specific permissions (these can override role permissions)
    for (const userPermission of user.user_permissions_user_permissions_user_idTouser_profiles) {
      const permission = userPermission.permissions;

      // User-specific permissions can override role permissions
      permissions.set(permission.name, {
        ...permission,
        granted: userPermission.granted, // Can be true (grant) or false (deny)
      });
    }

    // Build CASL rules from permissions
    for (const permission of permissions.values()) {
      const action = this.mapActionString(permission.action);
      const subject = permission.resource as Subjects;

      // Check if this permission is granted or denied
      const isGranted = permission.granted !== false; // Default to true if not specified

      // If permission has conditions, apply them
      if (permission.conditions && typeof permission.conditions === 'object') {
        const conditions = permission.conditions as PermissionConditions;

        // Replace ${userId} placeholder with actual user ID in conditions
        const processedConditions = this.processConditions(conditions, userId);

        if (isGranted) {
          can(action, subject, processedConditions);
        } else {
          cannot(action, subject, processedConditions);
        }
      } else {
        // No conditions
        if (isGranted) {
          can(action, subject);
        } else {
          cannot(action, subject);
        }
      }
    }

    return build();
  }

  /**
   * Map action string from database to Action enum
   */
  private mapActionString(action: string): Action {
    const actionMap: Record<string, Action> = {
      manage: Action.Manage,
      create: Action.Create,
      read: Action.Read,
      update: Action.Update,
      delete: Action.Delete,
      assign: Action.Assign,
      approve: Action.Approve,
      void: Action.Void,
      refund: Action.Refund,
      adjust: Action.Adjust,
      transfer: Action.Transfer,
      grant: Action.Grant,
      revoke: Action.Revoke,
      export: Action.Export,
      sales: Action.Sales,
      inventory: Action.Inventory,
      financial: Action.Financial,
      service: Action.Service,
    };

    return actionMap[action.toLowerCase()] || (action as Action);
  }

  /**
   * Process conditions to replace placeholders with actual values
   */
  private processConditions(
    conditions: PermissionConditions,
    userId: string,
  ): PermissionConditions {
    const processed: PermissionConditions = {};

    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === 'string' && value.includes('${userId}')) {
        processed[key] = value.replace('${userId}', userId);
      } else if (typeof value === 'object' && value !== null) {
        processed[key] = this.processConditions(value, userId);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Check if a user has a specific permission
   * Utility method for quick permission checks
   */
  async checkPermission(
    userId: string,
    action: Action,
    subject: Subjects,
  ): Promise<boolean> {
    const ability = await this.createForUser(userId);
    return ability.can(action, subject);
  }

  /**
   * Get all permissions for a user (useful for UI)
   */
  async getUserPermissions(userId: string): Promise<
    Array<{
      name: string;
      resource: string;
      action: string;
      description: string | null;
    }>
  > {
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
      return [];
    }

    const permissionsMap = new Map<string, any>();

    for (const userRole of user.user_roles_user_roles_user_idTouser_profiles) {
      for (const rolePermission of userRole.roles.role_permissions) {
        const permission = rolePermission.permissions;
        if (!permissionsMap.has(permission.name)) {
          permissionsMap.set(permission.name, {
            name: permission.name,
            resource: permission.resource,
            action: permission.action,
            description: permission.description,
          });
        }
      }
    }

    return Array.from(permissionsMap.values());
  }
}
