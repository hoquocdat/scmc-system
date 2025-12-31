import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { permissionsApi } from '@/lib/api/permissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import {
  LayoutDashboard,
  Wrench,
  Users,
  Bike,
  FileText,
  Package,
  CreditCard,
  BarChart3,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronsUpDown,
  Settings,
  User,
  UserCog,
  Columns3,
  ChevronDown,
  ChevronRight,
  Boxes,
  Building2,
  Tag,
  Warehouse,
  ShoppingCart,
  BarChart,
  ClipboardList,
  Monitor,
  Shield,
  FileSpreadsheet,
  ShoppingBag,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Fetch current user's roles and permissions (no policy check required)
  const { data: userRoles = [] } = useQuery({
    queryKey: ['my-roles'],
    queryFn: () => permissionsApi.getMyRoles(),
    enabled: !!user?.id,
  });

  const { data: userPermissions = [] } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => permissionsApi.getMyPermissions(),
    enabled: !!user?.id,
  });

  // Mobile detection - hide sidebar by default on mobile
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize sidebar state from localStorage (desktop) or hidden (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return false; // Closed by default on mobile
    }
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Initialize expanded menus from localStorage
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const saved = localStorage.getItem('expandedMenus');
    return saved !== null ? JSON.parse(saved) : ['service-orders'];
  });

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Persist expanded menus to localStorage
  useEffect(() => {
    localStorage.setItem('expandedMenus', JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navigation = [
    {
      name: t('navigation.dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['sales', 'employee', 'technician', 'manager', 'finance'],
    },
    {
      name: t('navigation.myWork'),
      href: '/my-work',
      icon: Wrench,
      roles: ['employee', 'technician'],
    },
    {
      name: t('navigation.customers'),
      href: '/customers',
      icon: Users,
      roles: ['sales', 'manager'],
    },
    {
      name: t('navigation.bikes'),
      href: '/bikes',
      icon: Bike,
      roles: ['sales', 'manager'],
    },
    {
      id: 'service-orders',
      name: t('navigation.serviceOrders'),
      icon: FileText,
      roles: ['sales', 'employee', 'technician', 'manager'],
      permission: { resource: 'service_orders', action: 'read' },
      children: [
        {
          name: 'Bảng Theo Dõi',
          href: '/service-board',
          icon: Columns3,
          roles: ['sales', 'employee', 'technician', 'manager'],
          permission: { resource: 'service_orders', action: 'read' },
        },
        {
          name: 'Danh Sách',
          href: '/service-orders',
          icon: FileText,
          roles: ['sales', 'employee', 'technician', 'manager'],
          permission: { resource: 'service_orders', action: 'read' },
        },
      ],
    },
    {
      id: 'products',
      name: 'Hàng hóa',
      icon: Package,
      roles: ['sales', 'manager'],
      children: [
        {
          name: 'Sản Phẩm',
          href: '/inventory/products',
          icon: Package,
          roles: ['sales', 'manager'],
        },
        {
          name: 'Đơn Đặt Hàng',
          href: '/inventory/purchase-orders',
          icon: ShoppingBag,
          roles: ['manager'],
        },
        {
          name: 'Thuộc Tính',
          href: '/inventory/attributes',
          icon: Tag,
          roles: ['manager'],
        },
        {
          name: 'Thương Hiệu',
          href: '/inventory/brands',
          icon: Tag,
          roles: ['manager'],
        },
        {
          name: 'Danh Mục',
          href: '/inventory/categories',
          icon: Boxes,
          roles: ['manager'],
        },
        {
          name: 'Nhà Cung Cấp',
          href: '/suppliers',
          icon: Building2,
          roles: ['manager'],
        },
      ],
    },
    {
      id: 'inventory',
      name: 'Kho Hàng',
      icon: Warehouse,
      roles: ['sales', 'manager'],
      children: [
        {
          name: 'Tồn Kho',
          href: '/inventory/stock',
          icon: BarChart,
          roles: ['sales', 'manager'],
        },
        {
          name: 'Điều Chỉnh Kho',
          href: '/inventory/adjustments',
          icon: ClipboardList,
          roles: ['manager'],
        },
      ],
    },
    {
      id: 'sales',
      name: 'Bán Hàng',
      icon: ShoppingCart,
      roles: ['sales', 'manager'],
      children: [
        {
          name: 'POS',
          href: '/pos',
          icon: Monitor,
          roles: ['sales', 'manager'],
        },
        {
          name: 'Đơn Hàng',
          href: '/sales/orders',
          icon: FileText,
          roles: ['sales', 'manager'],
        },
      ],
    },
    {
      name: t('navigation.payments'),
      href: '/payments',
      icon: CreditCard,
      roles: ['finance', 'manager'],
    },
    {
      name: t('navigation.reports'),
      href: '/reports',
      icon: BarChart3,
      roles: ['manager', 'finance'],
    },
    {
      name: t('navigation.employees'),
      href: '/employees',
      icon: UserCog,
      roles: ['manager'],
    },
    {
      id: 'settings',
      name: 'Cài Đặt',
      icon: Settings,
      roles: ['superadmin', 'manager'],
      children: [
        {
          name: 'Vai Trò',
          href: '/settings/roles',
          icon: Shield,
          roles: ['superadmin', 'manager'],
        },
        {
          name: 'Nhật Ký Quyền Hạn',
          href: '/settings/audit',
          icon: FileSpreadsheet,
          roles: ['superadmin', 'manager'],
        },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  // Helper function to check if user has permission
  const hasPermission = (resource: string, action: string): boolean => {
    // Check role-based permissions
    for (const userRole of userRoles) {
      const rolePermissions = (userRole as any).role_permissions || [];
      for (const rp of rolePermissions) {
        const perm = rp.permissions;
        if (perm.resource === resource && perm.action === action) {
          return true;
        }
      }
    }

    // Check user-specific permissions
    for (const up of userPermissions) {
      const perm = (up as any).permissions;
      if (perm.resource === resource && perm.action === action) {
        return (up as any).granted === true;
      }
    }

    return false;
  };

  const filteredNavigation = navigation.filter((item: any) => {
    // Check role-based access
    const hasRoleAccess = user?.role && item.roles.includes(user.role);

    // If no permission required, use role-based access only
    if (!item.permission) {
      return hasRoleAccess;
    }

    // Check permission-based access
    const hasPermissionAccess = hasPermission(
      item.permission.resource,
      item.permission.action
    );

    // User must have both role AND permission
    return hasRoleAccess && hasPermissionAccess;
  });

  // Generate breadcrumbs based on current path
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: Array<{ label: string; path: string; isLast: boolean }> = [];

    // Always start with Dashboard
    breadcrumbs.push({
      label: t('navigation.dashboard'),
      path: '/dashboard',
      isLast: false,
    });

    // Handle specific routes
    if (pathSegments.length > 0) {
      const firstSegment = pathSegments[0];

      // Map segments to translation keys
      const segmentLabels: Record<string, string> = {
        'customers': t('navigation.customers'),
        'bikes': t('navigation.bikes'),
        'service-orders': t('navigation.serviceOrders'),
        'service-board': 'Bảng Theo Dõi',
        'my-work': t('navigation.myWork'),
        'parts': t('navigation.parts'),
        'suppliers': 'Nhà Cung Cấp',
        'brands': 'Thương Hiệu',
        'categories': 'Danh Mục',
        'attributes': 'Thuộc Tính',
        'inventory': 'Kho Hàng',
        'products': 'Sản Phẩm',
        'stock': 'Tồn Kho',
        'adjustments': 'Điều Chỉnh Kho',
        'purchase-orders': 'Đơn Đặt Hàng',
        'sales': 'Bán Hàng',
        'orders': 'Đơn Hàng',
        'pos': 'POS',
        'payments': t('navigation.payments'),
        'reports': t('navigation.reports'),
        'employees': t('navigation.employees'),
      };

      if (segmentLabels[firstSegment]) {
        breadcrumbs.push({
          label: segmentLabels[firstSegment],
          path: `/${firstSegment}`,
          isLast: pathSegments.length === 1,
        });

        // Handle nested paths (e.g., /inventory/products, /sales/orders)
        if (pathSegments.length >= 2) {
          const secondSegment = pathSegments[1];

          // Check if second segment is a label (not an ID)
          if (segmentLabels[secondSegment]) {
            breadcrumbs.push({
              label: segmentLabels[secondSegment],
              path: `/${firstSegment}/${secondSegment}`,
              isLast: pathSegments.length === 2,
            });
          } else {
            // It's a detail page (has an ID)
            let detailLabel = t('serviceOrders.orderDetails');

            // Customize labels for detail pages
            if (firstSegment === 'service-orders') {
              detailLabel = t('serviceOrders.orderDetails');
            } else if (firstSegment === 'customers') {
              detailLabel = t('customers.customerDetails');
            } else if (firstSegment === 'bikes') {
              detailLabel = t('bikes.bikeDetails');
            }

            breadcrumbs.push({
              label: detailLabel,
              path: location.pathname,
              isLast: true,
            });
          }
        }
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isMobile
            ? sidebarOpen
              ? 'fixed left-0 top-0 bottom-0 w-64 z-50'
              : 'hidden'
            : sidebarOpen
            ? 'w-64'
            : 'w-16'
        } border-r bg-card transition-all duration-300 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="h-14 px-3 py-2 border-b flex items-center justify-between">
          {sidebarOpen && (
            <img className='w-20 h-auto' src="https://saigonclassic.com/wp-content/uploads/2024/08/Logo-SMCC.svg" alt="SCMC Workshop" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {filteredNavigation.map((item: any) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = item.id && expandedMenus.includes(item.id);
            const isParentActive = hasChildren && item.children.some((child: any) => isActive(child.href));

            if (hasChildren) {
              // When sidebar is collapsed, show submenu in a dropdown
              if (!sidebarOpen) {
                return (
                  <DropdownMenu key={item.id || item.name}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isParentActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                        title={item.name}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-48">
                      <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {item.children.map((child: any) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child.href);
                        return (
                          <DropdownMenuItem
                            key={child.href}
                            onClick={() => navigate(child.href)}
                            className={childActive ? 'bg-accent' : ''}
                          >
                            <ChildIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span>{child.name}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // When sidebar is open, show collapsible submenu
              return (
                <div key={item.id || item.name}>
                  <button
                    onClick={() => item.id && toggleMenu(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isParentActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child: any) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              childActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = item.href && isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                title={!sidebarOpen ? item.name : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer - User Menu */}
        <div className="p-2 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full ${
                  sidebarOpen ? 'justify-start' : 'justify-center p-2'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {sidebarOpen && (
                    <>
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="text-sm font-medium truncate w-full">
                          {user?.full_name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {user?.email}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    </>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56"
              align={sidebarOpen ? 'end' : 'start'}
              side="top"
            >
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>{t('navigation.dashboard')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('navigation.settings')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('navigation.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b bg-card px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {/* Mobile menu button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          onClick={() => navigate(crumb.path)}
                          className="cursor-pointer"
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
            <span className="text-xs sm:text-sm text-muted-foreground hidden md:block">
              Welcome, <span className="font-medium">{user?.full_name}</span>
            </span>
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
