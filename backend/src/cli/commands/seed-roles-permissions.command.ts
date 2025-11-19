import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface Permission {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

interface Role {
  name: string;
  description: string;
  is_system: boolean;
  permissions: string[]; // Permission names
}

@Injectable()
@Command({
  name: 'seed:roles-permissions',
  description: 'Seed roles and permissions data',
})
export class SeedRolesPermissionsCommand extends CommandRunner {
  // Define all permissions
  private readonly permissions: Permission[] = [
    // Service Orders permissions
    { name: 'service_orders:create', resource: 'service_orders', action: 'create', description: 'Create service orders' },
    { name: 'service_orders:read', resource: 'service_orders', action: 'read', description: 'View service orders' },
    { name: 'service_orders:update', resource: 'service_orders', action: 'update', description: 'Update service orders' },
    { name: 'service_orders:delete', resource: 'service_orders', action: 'delete', description: 'Delete service orders' },
    { name: 'service_orders:assign', resource: 'service_orders', action: 'assign', description: 'Assign technicians to service orders' },
    { name: 'service_orders:approve', resource: 'service_orders', action: 'approve', description: 'Approve service orders' },

    // Customers permissions
    { name: 'customers:create', resource: 'customers', action: 'create', description: 'Create customers' },
    { name: 'customers:read', resource: 'customers', action: 'read', description: 'View customers' },
    { name: 'customers:update', resource: 'customers', action: 'update', description: 'Update customers' },
    { name: 'customers:delete', resource: 'customers', action: 'delete', description: 'Delete customers' },

    // Bikes permissions
    { name: 'bikes:create', resource: 'bikes', action: 'create', description: 'Create bikes' },
    { name: 'bikes:read', resource: 'bikes', action: 'read', description: 'View bikes' },
    { name: 'bikes:update', resource: 'bikes', action: 'update', description: 'Update bikes' },
    { name: 'bikes:delete', resource: 'bikes', action: 'delete', description: 'Delete bikes' },

    // Parts/Inventory permissions
    { name: 'parts:create', resource: 'parts', action: 'create', description: 'Create parts' },
    { name: 'parts:read', resource: 'parts', action: 'read', description: 'View parts' },
    { name: 'parts:update', resource: 'parts', action: 'update', description: 'Update parts' },
    { name: 'parts:delete', resource: 'parts', action: 'delete', description: 'Delete parts' },
    { name: 'parts:adjust', resource: 'parts', action: 'adjust', description: 'Adjust part inventory' },

    // Payments permissions
    { name: 'payments:create', resource: 'payments', action: 'create', description: 'Create payments' },
    { name: 'payments:read', resource: 'payments', action: 'read', description: 'View payments' },
    { name: 'payments:update', resource: 'payments', action: 'update', description: 'Update payments' },
    { name: 'payments:void', resource: 'payments', action: 'void', description: 'Void payments' },
    { name: 'payments:refund', resource: 'payments', action: 'refund', description: 'Refund payments' },

    // POS permissions
    { name: 'pos_sessions:create', resource: 'pos_sessions', action: 'create', description: 'Open POS sessions' },
    { name: 'pos_sessions:read', resource: 'pos_sessions', action: 'read', description: 'View POS sessions' },
    { name: 'pos_sessions:update', resource: 'pos_sessions', action: 'update', description: 'Close POS sessions' },
    { name: 'pos_transactions:create', resource: 'pos_transactions', action: 'create', description: 'Create POS transactions' },
    { name: 'pos_transactions:read', resource: 'pos_transactions', action: 'read', description: 'View POS transactions' },
    { name: 'pos_transactions:void', resource: 'pos_transactions', action: 'void', description: 'Void POS transactions' },

    // Sales Orders permissions
    { name: 'sales_orders:create', resource: 'sales_orders', action: 'create', description: 'Create sales orders' },
    { name: 'sales_orders:read', resource: 'sales_orders', action: 'read', description: 'View sales orders' },
    { name: 'sales_orders:update', resource: 'sales_orders', action: 'update', description: 'Update sales orders' },
    { name: 'sales_orders:delete', resource: 'sales_orders', action: 'delete', description: 'Delete sales orders' },

    // Reports permissions
    { name: 'reports:read', resource: 'reports', action: 'read', description: 'View reports' },
    { name: 'reports:export', resource: 'reports', action: 'export', description: 'Export reports' },

    // Users/Permissions management
    { name: 'users:create', resource: 'users', action: 'create', description: 'Create users' },
    { name: 'users:read', resource: 'users', action: 'read', description: 'View users' },
    { name: 'users:update', resource: 'users', action: 'update', description: 'Update users' },
    { name: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },
    { name: 'permissions:read', resource: 'permissions', action: 'read', description: 'View permissions' },
    { name: 'roles:read', resource: 'roles', action: 'read', description: 'View roles' },
    { name: 'roles:create', resource: 'roles', action: 'create', description: 'Create roles' },
    { name: 'roles:update', resource: 'roles', action: 'update', description: 'Update roles' },
    { name: 'roles:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
    { name: 'roles:grant', resource: 'roles', action: 'grant', description: 'Grant roles to users' },
    { name: 'roles:revoke', resource: 'roles', action: 'revoke', description: 'Revoke roles from users' },
  ];

  // Define roles with their permissions
  private readonly roles: Role[] = [
    {
      name: 'sales',
      description: 'Sales staff - Can create service orders, register customers, and schedule appointments',
      is_system: true,
      permissions: [
        'service_orders:create',
        'service_orders:read',
        'service_orders:update',
        'customers:create',
        'customers:read',
        'customers:update',
        'bikes:create',
        'bikes:read',
        'bikes:update',
        'parts:read',
      ],
    },
    {
      name: 'technician',
      description: 'Technician - Can view assigned work, update progress, and record parts usage',
      is_system: true,
      permissions: [
        'service_orders:read',
        'service_orders:update',
        'customers:read',
        'bikes:read',
        'parts:read',
        'parts:update',
      ],
    },
    {
      name: 'manager',
      description: 'Manager - Can monitor all operations, assign technicians, approve work, and view analytics',
      is_system: true,
      permissions: [
        'service_orders:create',
        'service_orders:read',
        'service_orders:update',
        'service_orders:delete',
        'service_orders:assign',
        'service_orders:approve',
        'customers:create',
        'customers:read',
        'customers:update',
        'customers:delete',
        'bikes:create',
        'bikes:read',
        'bikes:update',
        'bikes:delete',
        'parts:create',
        'parts:read',
        'parts:update',
        'parts:delete',
        'parts:adjust',
        'payments:read',
        'pos_sessions:read',
        'pos_transactions:read',
        'sales_orders:read',
        'reports:read',
        'reports:export',
        'users:read',
        'permissions:read',
        'roles:read',
      ],
    },
    {
      name: 'finance',
      description: 'Finance - Can process payments, generate invoices, and track receivables',
      is_system: true,
      permissions: [
        'service_orders:read',
        'customers:read',
        'bikes:read',
        'payments:create',
        'payments:read',
        'payments:update',
        'payments:void',
        'payments:refund',
        'pos_sessions:create',
        'pos_sessions:read',
        'pos_sessions:update',
        'pos_transactions:create',
        'pos_transactions:read',
        'pos_transactions:void',
        'sales_orders:create',
        'sales_orders:read',
        'sales_orders:update',
        'reports:read',
        'reports:export',
      ],
    },
    {
      name: 'admin',
      description: 'Administrator - Full system access',
      is_system: true,
      permissions: this.permissions.map(p => p.name), // All permissions
    },
  ];

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(): Promise<void> {
    console.log('🌱 Starting roles and permissions seed...\n');

    try {
      // Step 1: Seed permissions
      console.log('📋 Seeding permissions...');
      const permissionMap = new Map<string, string>(); // name -> id

      for (const permission of this.permissions) {
        const existingPermission = await this.prisma.permissions.findFirst({
          where: { name: permission.name },
        });

        if (existingPermission) {
          console.log(`  ✓ Permission "${permission.name}" already exists`);
          permissionMap.set(permission.name, existingPermission.id);
        } else {
          const created = await this.prisma.permissions.create({
            data: {
              name: permission.name,
              resource: permission.resource,
              action: permission.action,
              description: permission.description,
            },
          });
          permissionMap.set(permission.name, created.id);
          console.log(`  ✓ Created permission: ${permission.name}`);
        }
      }

      console.log(`\n✅ Seeded ${this.permissions.length} permissions\n`);

      // Step 2: Seed roles
      console.log('👥 Seeding roles...');
      const roleMap = new Map<string, string>(); // name -> id

      for (const role of this.roles) {
        const existingRole = await this.prisma.roles.findFirst({
          where: { name: role.name },
        });

        let roleId: string;

        if (existingRole) {
          console.log(`  ✓ Role "${role.name}" already exists`);
          roleId = existingRole.id;

          // Update description if different
          if (existingRole.description !== role.description) {
            await this.prisma.roles.update({
              where: { id: roleId },
              data: { description: role.description },
            });
            console.log(`    → Updated description`);
          }
        } else {
          const created = await this.prisma.roles.create({
            data: {
              name: role.name,
              description: role.description,
              is_system: role.is_system,
            },
          });
          roleId = created.id;
          console.log(`  ✓ Created role: ${role.name}`);
        }

        roleMap.set(role.name, roleId);

        // Step 3: Assign permissions to role
        console.log(`  → Assigning permissions to "${role.name}"...`);

        // Get current permissions for this role
        const currentRolePermissions = await this.prisma.role_permissions.findMany({
          where: { role_id: roleId },
          include: { permissions: true },
        });

        const currentPermissionNames = new Set(
          currentRolePermissions.map(rp => rp.permissions.name),
        );

        const targetPermissionNames = new Set(role.permissions);

        // Add missing permissions
        for (const permissionName of role.permissions) {
          if (!currentPermissionNames.has(permissionName)) {
            const permissionId = permissionMap.get(permissionName);
            if (permissionId) {
              await this.prisma.role_permissions.create({
                data: {
                  role_id: roleId,
                  permission_id: permissionId,
                },
              });
              console.log(`    ✓ Added permission: ${permissionName}`);
            }
          }
        }

        // Remove extra permissions
        for (const currentRP of currentRolePermissions) {
          if (!targetPermissionNames.has(currentRP.permissions.name)) {
            await this.prisma.role_permissions.delete({
              where: {
                role_id_permission_id: {
                  role_id: roleId,
                  permission_id: currentRP.permission_id,
                },
              },
            });
            console.log(`    ✓ Removed permission: ${currentRP.permissions.name}`);
          }
        }

        console.log(`  ✅ Role "${role.name}" has ${role.permissions.length} permissions\n`);
      }

      console.log('✅ Roles and permissions seed completed successfully!\n');
      console.log('Summary:');
      console.log(`  - ${this.permissions.length} permissions`);
      console.log(`  - ${this.roles.length} roles`);
      console.log('\nRoles created:');
      this.roles.forEach(role => {
        console.log(`  • ${role.name}: ${role.description}`);
      });
    } catch (error) {
      console.error('❌ Error seeding roles and permissions:', error);
      throw error;
    }
  }
}
