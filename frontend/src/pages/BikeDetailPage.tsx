import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Motorcycle, ServiceOrder, Customer } from '../types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { BikeInfoTab } from '@/components/bikes/BikeInfoTab';
import { BikeImagesTab } from '@/components/bikes/BikeImagesTab';
import { BikeOwnerTab } from '@/components/bikes/BikeOwnerTab';
import { BikeServiceHistoryTab } from '@/components/bikes/BikeServiceHistoryTab';

export function BikeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useUrlTabs('info');

  // Fetch bike details with useQuery
  const { data: bike, isLoading: isLoadingBike, refetch: refetchBike } = useQuery({
    queryKey: ['bike', id],
    queryFn: async () => {
      const bikeData: any = await apiClient.bikes.getOne(id!);
      return bikeData as Motorcycle;
    },
    enabled: !!id,
  });

  // Fetch owner details (depends on bike data)
  const { data: owner, isLoading: isLoadingOwner } = useQuery({
    queryKey: ['customer', bike?.owner_id],
    queryFn: async () => {
      if (!bike?.owner_id) return null;
      const ownerData: any = await apiClient.customers.getOne(bike.owner_id);
      return ownerData as Customer;
    },
    enabled: !!bike?.owner_id,
  });

  // Fetch service orders for this bike
  const { data: serviceOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['service-orders', 'bike', id],
    queryFn: async () => {
      const ordersResponse: any = await apiClient.serviceOrders.getAll(1, 100);
      const bikeOrders = (ordersResponse.data || []).filter(
        (order: any) => order.motorcycle_id === id
      );
      return bikeOrders;
    },
    enabled: !!id,
  });

  const serviceOrders: ServiceOrder[] = serviceOrdersData || [];
  const isLoading = isLoadingBike || isLoadingOwner || isLoadingOrders;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Đang tải thông tin xe...</div>
      </div>
    );
  }

  if (!bike) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-lg mb-4">Không tìm thấy xe</p>
          <Button onClick={() => navigate('/bikes')}>
            Quay Lại Danh Sách
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          {bike.brand} {bike.model}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {bike.license_plate} {bike.year && `• ${bike.year}`}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="info" className="whitespace-nowrap">Thông Tin Xe</TabsTrigger>
            <TabsTrigger value="images" className="whitespace-nowrap">Hình Ảnh</TabsTrigger>
            <TabsTrigger value="owner" className="whitespace-nowrap">Chủ Xe</TabsTrigger>
            <TabsTrigger value="service-history" className="whitespace-nowrap">Lịch Sử Dịch Vụ</TabsTrigger>
          </TabsList>
        </div>

        {/* Bike Info Tab */}
        <TabsContent value="info">
          <BikeInfoTab bike={bike} />
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images">
          <BikeImagesTab bike={bike} onBikeUpdate={refetchBike} />
        </TabsContent>

        {/* Owner Tab */}
        <TabsContent value="owner">
          <BikeOwnerTab owner={owner || null} />
        </TabsContent>

        {/* Service History Tab */}
        <TabsContent value="service-history">
          <BikeServiceHistoryTab serviceOrders={serviceOrders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
