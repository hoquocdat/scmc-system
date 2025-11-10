import { SetMetadata } from '@nestjs/common';

export type UserRole = 'sales' | 'technician' | 'manager' | 'finance';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
