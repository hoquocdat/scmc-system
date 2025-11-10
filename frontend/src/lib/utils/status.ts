/**
 * Utility functions for service order status handling
 */

export type ServiceOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'waiting_parts'
  | 'waiting_approval'
  | 'quality_check'
  | 'completed'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled';

/**
 * Get Tailwind CSS classes for status badge styling
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    waiting_parts: 'bg-orange-100 text-orange-800',
    waiting_approval: 'bg-pink-100 text-pink-800',
    quality_check: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
    ready_for_pickup: 'bg-teal-100 text-teal-800',
    delivered: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get human-readable Vietnamese label for status
 */
export function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    pending: 'Chờ Xác Nhận',
    confirmed: 'Đã Xác Nhận',
    in_progress: 'Đang Xử Lý',
    waiting_parts: 'Chờ Phụ Tùng',
    waiting_approval: 'Chờ Phê Duyệt',
    quality_check: 'Kiểm Tra Chất Lượng',
    completed: 'Hoàn Thành',
    ready_for_pickup: 'Sẵn Sàng Giao',
    delivered: 'Đã Giao',
    cancelled: 'Đã Hủy',
  };
  return statusLabels[status] || status;
}

/**
 * Get simple English label with spaces instead of underscores
 */
export function getStatusLabelSimple(status: string): string {
  return status.replace(/_/g, ' ');
}

/**
 * Check if a status is considered "in service" (not delivered or cancelled)
 */
export function isInService(status: string): boolean {
  return status !== 'delivered' && status !== 'cancelled';
}

/**
 * Get all available service order statuses
 */
export function getAllStatuses(): ServiceOrderStatus[] {
  return [
    'pending',
    'confirmed',
    'in_progress',
    'waiting_parts',
    'waiting_approval',
    'quality_check',
    'completed',
    'ready_for_pickup',
    'delivered',
    'cancelled',
  ];
}
