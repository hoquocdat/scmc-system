/**
 * Permission display name mappings
 * Maps resource:action to friendly Vietnamese names
 */

export const PERMISSION_FRIENDLY_NAMES: Record<string, string> = {
  // Service Orders
  'service_orders:read': 'Xem Service Orders',
  'service_orders:create': 'Tạo Service Order',
  'service_orders:update': 'Cập nhật Service Order',
  'service_orders:delete': 'Xóa Service Order',
  'service_orders:manage': 'Quản lý toàn bộ Service Orders',

  // Users
  'users:read': 'Xem người dùng',
  'users:create': 'Tạo người dùng',
  'users:update': 'Cập nhật người dùng',
  'users:delete': 'Xóa người dùng',
  'users:manage': 'Quản lý toàn bộ người dùng',

  // Permissions
  'permissions:read': 'Xem quyền hạn',
  'permissions:create': 'Tạo quyền',
  'permissions:update': 'Cập nhật quyền',
  'permissions:delete': 'Xóa quyền',
  'permissions:grant': 'Cấp quyền',
  'permissions:revoke': 'Thu hồi quyền',
  'permissions:manage': 'Quản lý toàn bộ quyền hạn',

  // Roles
  'roles:read': 'Xem vai trò',
  'roles:create': 'Tạo vai trò',
  'roles:update': 'Cập nhật vai trò',
  'roles:delete': 'Xóa vai trò',
  'roles:manage': 'Quản lý toàn bộ vai trò',

  // Products
  'products:read': 'Xem sản phẩm',
  'products:create': 'Tạo sản phẩm',
  'products:update': 'Cập nhật sản phẩm',
  'products:delete': 'Xóa sản phẩm',
  'products:manage': 'Quản lý toàn bộ sản phẩm',

  // Inventory
  'inventory:read': 'Xem kho hàng',
  'inventory:create': 'Nhập kho',
  'inventory:update': 'Cập nhật kho',
  'inventory:delete': 'Xóa dữ liệu kho',
  'inventory:adjust': 'Điều chỉnh tồn kho',
  'inventory:manage': 'Quản lý toàn bộ kho hàng',

  // Customers
  'customers:read': 'Xem khách hàng',
  'customers:create': 'Tạo khách hàng',
  'customers:update': 'Cập nhật khách hàng',
  'customers:delete': 'Xóa khách hàng',
  'customers:manage': 'Quản lý toàn bộ khách hàng',

  // Reports
  'reports:read': 'Xem báo cáo',
  'reports:create': 'Tạo báo cáo',
  'reports:export': 'Xuất báo cáo',
  'reports:manage': 'Quản lý toàn bộ báo cáo',

  // Payments
  'payments:read': 'Xem thanh toán',
  'payments:create': 'Tạo thanh toán',
  'payments:update': 'Cập nhật thanh toán',
  'payments:delete': 'Xóa thanh toán',
  'payments:manage': 'Quản lý toàn bộ thanh toán',

  // Settings
  'settings:read': 'Xem cài đặt',
  'settings:update': 'Cập nhật cài đặt',
  'settings:manage': 'Quản lý toàn bộ cài đặt',
};

/**
 * Resource display name mappings
 */
export const RESOURCE_FRIENDLY_NAMES: Record<string, string> = {
  service_orders: 'Service Orders',
  users: 'Người dùng',
  permissions: 'Quyền hạn',
  roles: 'Vai trò',
  products: 'Sản phẩm',
  inventory: 'Kho hàng',
  customers: 'Khách hàng',
  reports: 'Báo cáo',
  payments: 'Thanh toán',
  settings: 'Cài đặt',
};

/**
 * Action display name mappings
 */
export const ACTION_FRIENDLY_NAMES: Record<string, string> = {
  read: 'Xem',
  create: 'Tạo',
  update: 'Cập nhật',
  delete: 'Xóa',
  manage: 'Quản lý',
  grant: 'Cấp',
  revoke: 'Thu hồi',
  adjust: 'Điều chỉnh',
  export: 'Xuất',
};

/**
 * Get friendly name for a permission
 * @param resource - Permission resource
 * @param action - Permission action
 * @returns Friendly Vietnamese name
 */
export function getPermissionFriendlyName(resource: string, action: string): string {
  const key = `${resource}:${action}`;

  // Try to get from specific mapping first
  if (PERMISSION_FRIENDLY_NAMES[key]) {
    return PERMISSION_FRIENDLY_NAMES[key];
  }

  // Fallback to resource + action combination
  const resourceName = RESOURCE_FRIENDLY_NAMES[resource] || resource;
  const actionName = ACTION_FRIENDLY_NAMES[action] || action;

  return `${actionName} ${resourceName}`;
}

/**
 * Get friendly name for a resource
 * @param resource - Permission resource
 * @returns Friendly Vietnamese name
 */
export function getResourceFriendlyName(resource: string): string {
  return RESOURCE_FRIENDLY_NAMES[resource] || resource;
}

/**
 * Get friendly name for an action
 * @param action - Permission action
 * @returns Friendly Vietnamese name
 */
export function getActionFriendlyName(action: string): string {
  return ACTION_FRIENDLY_NAMES[action] || action;
}
