// Route title mapping
const routeTitles: Record<string, string> = {
  '/dashboard': 'Bảng Điều Khiển',
  '/customers': 'Quản Lý Khách Hàng',
  '/bikes': 'Quản Lý Xe',
  '/service-orders': 'Đơn Dịch Vụ',
  '/service-board': 'Bảng Theo Dõi Dịch Vụ',
  '/my-work': 'Công Việc Của Tôi',
  '/parts': 'Quản Lý Phụ Tùng',
  '/suppliers': 'Nhà Cung Cấp',
  '/payments': 'Thanh Toán',
  '/reports': 'Báo Cáo',
  '/employees': 'Quản Lý Nhân Viên',
  '/inventory/products': 'Sản Phẩm',
  '/inventory/brands': 'Thương Hiệu',
  '/inventory/categories': 'Danh Mục Sản Phẩm',
  '/inventory/stock': 'Tồn Kho',
  '/inventory/adjustments': 'Điều Chỉnh Kho',
  '/sales/orders': 'Đơn Bán Hàng',
  '/pos': 'Điểm Bán Hàng',
  '/settings/roles': 'Vai Trò & Quyền',
  '/settings/audit': 'Kiểm Tra Quyền',
  '/login': 'Đăng Nhập',
};

/**
 * Get page title from pathname
 */
export const getPageTitle = (pathname: string): string => {
  // Check for exact match first
  if (routeTitles[pathname]) {
    return `${routeTitles[pathname]} - SCMC Workspace`;
  }

  // Check for dynamic routes (detail pages, edit pages)
  if (pathname.startsWith('/customers/') && pathname !== '/customers') {
    return 'Chi Tiết Khách Hàng - SCMC Workspace';
  }
  if (pathname.startsWith('/bikes/') && pathname !== '/bikes') {
    return 'Chi Tiết Xe - SCMC Workspace';
  }
  if (pathname.startsWith('/service-orders/') && pathname !== '/service-orders') {
    return 'Chi Tiết Đơn Dịch Vụ - SCMC Workspace';
  }
  if (pathname.startsWith('/employees/') && pathname.endsWith('/edit')) {
    return 'Chỉnh Sửa Nhân Viên - SCMC Workspace';
  }
  if (pathname.startsWith('/employees/') && pathname !== '/employees') {
    return 'Chi Tiết Nhân Viên - SCMC Workspace';
  }
  if (pathname.startsWith('/inventory/products/') && pathname.endsWith('/edit')) {
    return 'Chỉnh Sửa Sản Phẩm - SCMC Workspace';
  }
  if (pathname === '/inventory/products/new') {
    return 'Thêm Sản Phẩm Mới - SCMC Workspace';
  }
  if (pathname.startsWith('/inventory/products/') && pathname !== '/inventory/products') {
    return 'Chi Tiết Sản Phẩm - SCMC Workspace';
  }
  if (pathname === '/inventory/categories/new') {
    return 'Thêm Danh Mục Mới - SCMC Workspace';
  }
  if (pathname.startsWith('/inventory/categories/') && pathname.endsWith('/edit')) {
    return 'Chỉnh Sửa Danh Mục - SCMC Workspace';
  }
  if (pathname.startsWith('/settings/roles/') && pathname !== '/settings/roles') {
    return 'Chi Tiết Vai Trò - SCMC Workspace';
  }

  // Default fallback
  return 'SCMC Workspace';
};
