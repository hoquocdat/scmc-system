import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Customer, Motorcycle, ServiceOrder } from '../types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { CustomerInfoTab } from '@/components/customers/CustomerInfoTab';
import { CustomerBikesTab } from '@/components/customers/CustomerBikesTab';
import { CustomerServiceHistoryTab } from '@/components/customers/CustomerServiceHistoryTab';
import { CustomerReceivablesTab } from '@/components/customers/CustomerReceivablesTab';
import { CustomerSalesOrdersTab } from '@/components/customers/CustomerSalesOrdersTab';
import { CustomerEditSheet } from '@/components/customers/CustomerEditSheet';
import { AddBikeSheet } from '@/components/customers/AddBikeSheet';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useUrlTabs('info');
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isAddBikeSheetOpen, setIsAddBikeSheetOpen] = useState(false);

  // Fetch customer details with useQuery
  const { data: customer, isLoading: isLoadingCustomer, refetch: refetchCustomer } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const customerData: any = await apiClient.customers.getOne(id!);
      return customerData as Customer;
    },
    enabled: !!id,
  });

  // Fetch bikes owned by this customer
  const { data: bikesData, isLoading: isLoadingBikes, refetch: refetchBikes } = useQuery({
    queryKey: ['bikes', 'customer', id],
    queryFn: async () => {
      const bikesResponse: any = await apiClient.bikes.getByOwner(id!);
      return bikesResponse || [];
    },
    enabled: !!id,
  });

  const bikes: Motorcycle[] = bikesData || [];

  // Fetch service orders for this customer
  const { data: serviceOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['service-orders', 'customer', id],
    queryFn: async () => {
      const ordersResponse: any = await apiClient.serviceOrders.getAll(1, 100);
      const customerOrders = (ordersResponse.data || []).filter(
        (order: any) => order.customer_id === id || (order.motorcycle_id &&
          bikes.some((bike: any) => bike.id === order.motorcycle_id))
      );
      return customerOrders;
    },
    enabled: !!id && !!bikes.length,
  });

  const serviceOrders: ServiceOrder[] = serviceOrdersData || [];
  const isLoading = isLoadingCustomer || isLoadingBikes || isLoadingOrders;

  const handleEditSuccess = () => {
    toast.success('Cập nhật thông tin khách hàng thành công');
    refetchCustomer();
  };

  const handleEditError = (message: string) => {
    toast.error(message);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Đang tải thông tin khách hàng...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-lg mb-4">Không tìm thấy khách hàng</p>
          <Button onClick={() => navigate('/customers')}>
            Quay Lại Danh Sách
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {customer.full_name}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {customer.phone} {customer.email && `• ${customer.email}`}
          </p>
        </div>
        <Button onClick={() => setIsEditSheetOpen(true)} variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Sửa
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="info" className="whitespace-nowrap">
              <span className="hidden sm:inline">Thông Tin</span>
              <span className="sm:hidden">Info</span>
            </TabsTrigger>
            <TabsTrigger value="receivables" className="whitespace-nowrap">
              <span className="hidden sm:inline">Công Nợ</span>
              <span className="sm:hidden">Nợ</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="whitespace-nowrap">
              <span className="hidden sm:inline">Đơn Hàng</span>
              <span className="sm:hidden">Đơn</span>
            </TabsTrigger>
            <TabsTrigger value="bikes" className="whitespace-nowrap">
              <span className="hidden sm:inline">Xe Sở Hữu</span>
              <span className="sm:hidden">Xe</span>
            </TabsTrigger>
            <TabsTrigger value="service-history" className="whitespace-nowrap">
              <span className="hidden sm:inline">Lịch Sử Dịch Vụ</span>
              <span className="sm:hidden">Dịch Vụ</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Customer Info Tab */}
        <TabsContent value="info">
          <CustomerInfoTab customer={customer} />
        </TabsContent>

        {/* Receivables Tab */}
        <TabsContent value="receivables">
          <CustomerReceivablesTab customerId={id!} />
        </TabsContent>

        {/* Sales Orders Tab */}
        <TabsContent value="orders">
          <CustomerSalesOrdersTab customerId={id!} />
        </TabsContent>

        {/* Bikes Tab */}
        <TabsContent value="bikes">
          <CustomerBikesTab
            bikes={bikes}
            onAddBike={() => setIsAddBikeSheetOpen(true)}
          />
        </TabsContent>

        {/* Service History Tab */}
        <TabsContent value="service-history">
          <CustomerServiceHistoryTab serviceOrders={serviceOrders} />
        </TabsContent>
      </Tabs>

      {/* Edit Sheet */}
      <CustomerEditSheet
        customer={customer}
        isOpen={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        onSuccess={handleEditSuccess}
        onError={handleEditError}
      />

      {/* Add Bike Sheet */}
      <AddBikeSheet
        ownerId={id!}
        isOpen={isAddBikeSheetOpen}
        onClose={() => setIsAddBikeSheetOpen(false)}
        onSuccess={refetchBikes}
      />
    </div>
  );
}
