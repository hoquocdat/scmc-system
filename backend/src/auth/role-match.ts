/**
 * Role check shared by the legacy @Roles guards.
 *
 * - superadmin passes every @Roles check (it holds every permission in the
 *   permission system, but no @Roles list names it).
 * - Some @Roles lists use names that are not values of the user_role enum;
 *   they are read as the roles they were meant to be.
 */
const ALIASES: Record<string, string[]> = {
  admin: ['superadmin'],
  warehouse: ['warehouse_staff'],
  sales: ['sales', 'sales_associate'],
};

export function roleMatches(userRole: string | undefined | null, required: readonly string[]): boolean {
  if (!userRole) return false;
  if (userRole === 'superadmin') return true;
  return required.some((r) => r === userRole || (ALIASES[r]?.includes(userRole) ?? false));
}
