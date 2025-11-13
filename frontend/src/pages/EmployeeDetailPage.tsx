import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { UserProfile, ServiceOrder } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Phone, Mail, User, Wrench, Activity, Shield } from 'lucide-react';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { getStatusColor, getStatusLabel } from '@/lib/utils/status';
import { PermissionsMatrixTab } from '@/components/employees/PermissionsMatrixTab';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useUrlTabs('overview');

  // Fetch employee details with useQuery
  const { data: employee, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const employeeData: any = await apiClient.users.getOne(id!);
      return employeeData as UserProfile;
    },
    enabled: !!id,
  });

  // Fetch service orders assigned to this employee
  const { data: serviceOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['service-orders', 'employee', id],
    queryFn: async () => {
      const ordersResponse: any = await apiClient.serviceOrders.getAll(1, 100, { employee: [id!] });
      return ordersResponse.data || [];
    },
    enabled: !!id,
  });

  const serviceOrders: ServiceOrder[] = serviceOrdersData || [];
  const isLoading = isLoadingEmployee || isLoadingOrders;

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      technician: 'Kỹ Thuật Viên',
      sales: 'Nhân Viên Bán Hàng',
      manager: 'Quản Lý',
      finance: 'Kế Toán',
    };
    return roleLabels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, string> = {
      technician: 'bg-blue-100 text-blue-800',
      sales: 'bg-green-100 text-green-800',
      manager: 'bg-purple-100 text-purple-800',
      finance: 'bg-amber-100 text-amber-800',
    };
    return roleColors[role] || 'bg-gray-100 text-gray-800';
  };


  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center">Đang tải thông tin nhân viên...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center">
          <p className="text-lg mb-4">Không tìm thấy nhân viên</p>
          <Button onClick={() => navigate('/employees')}>
            Quay Lại Danh Sách
          </Button>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    total: serviceOrders.length,
    inProgress: serviceOrders.filter(o => o.status === 'in_progress').length,
    completed: serviceOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length,
    pending: serviceOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/employees')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay Lại
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                {employee.full_name}
              </h1>
              <Badge className={getRoleColor(employee.role)}>
                {getRoleLabel(employee.role)}
              </Badge>
              <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                {employee.is_active ? 'Hoạt Động' : 'Ngừng Hoạt Động'}
              </Badge>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">Chi Tiết Nhân Viên</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="overview" className="whitespace-nowrap">Tổng Quan</TabsTrigger>
            <TabsTrigger value="permissions" className="whitespace-nowrap">Ma trận quyền</TabsTrigger>
            <TabsTrigger value="service-orders" className="whitespace-nowrap">
              Service Orders ({serviceOrders.length})
            </TabsTrigger>
            <TabsTrigger value="activities" className="whitespace-nowrap hidden sm:flex">Hoạt Động</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
            {/* Employee Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Thông Tin Cá Nhân
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">
                      {employee.email || '-'}
                    </p>
                  </div>
                </div>

                {employee.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Số Điện Thoại</p>
                      <p className="text-sm text-muted-foreground">{employee.phone}</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Tham gia từ: {new Date(employee.created_at).toLocaleDateString('vi-VN')}
                  </p>
                  {employee.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Cập nhật: {new Date(employee.updated_at).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Work Statistics */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Thống Kê Công Việc
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Tổng Số</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats.inProgress}</div>
                    <div className="text-sm text-muted-foreground">Đang Xử Lý</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    <div className="text-sm text-muted-foreground">Hoàn Thành</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                    <div className="text-sm text-muted-foreground">Chờ Xử Lý</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Permissions Matrix Tab */}
        <TabsContent value="permissions">
          <PermissionsMatrixTab userId={id!} />
        </TabsContent>

        {/* Service Orders Tab */}
        <TabsContent value="service-orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Service Orders Được Giao ({serviceOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {serviceOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Chưa có service order nào được giao cho nhân viên này
                </p>
              ) : (
                <div className="space-y-3">
                  {serviceOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/service-orders/${order.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium text-sm sm:text-base">{order.order_number}</span>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {order.description || 'Không có mô tả'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Tạo ngày: {new Date(order.created_at).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="hidden sm:flex">
                        Xem Chi Tiết
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Hoạt Động Gần Đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serviceOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Chưa có hoạt động nào
                  </p>
                ) : (
                  <div className="space-y-3">
                    {serviceOrders
                      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
                      .slice(0, 10)
                      .map((order) => (
                        <div
                          key={order.id}
                          className="flex items-start gap-4 p-4 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {order.order_number}
                              </span>
                              <Badge className={getStatusColor(order.status)} variant="outline">
                                {getStatusLabel(order.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Cập nhật lần cuối:{' '}
                              {new Date(order.updated_at || order.created_at).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
