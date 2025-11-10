export const ROLE_LABELS: Record<string, string> = {
  'manager': 'Quản lý',
  'sales': 'Bán hàng',
  'technician': 'Kỹ thuật viên',
  'finance': 'Tài chính',
  'admin': 'Quản trị viên',
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}
