import { SetMetadata } from '@nestjs/common';

export type UserRole =
  | 'sales'
  | 'technician'
  | 'manager'
  | 'finance'
  | 'store_manager'
  | 'sales_associate'
  | 'warehouse_staff';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
