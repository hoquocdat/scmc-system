import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Customer, UserProfile } from '../types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ServiceOrderTable } from '@/components/service-orders/ServiceOrderTable';
import { ServiceOrderToolbar } from '@/components/service-orders/ServiceOrderToolbar';
import { ServiceOrderForm, type ServiceOrderFormData } from '@/components/service-orders/ServiceOrderForm';
import { createServiceOrderColumns, type ServiceOrderWithDetails } from '@/components/service-orders/ServiceOrderColumns';

export function ServiceOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Derive filter values directly from URL params so they're always in sync
  const searchQuery = searchParams.get('search') || '';
  const statusFilter = useMemo(
    () => searchParams.get('status')?.split(',').filter(Boolean) || [],
    [searchParams]
  );
  const priorityFilter = useMemo(
    () => searchParams.get('priority')?.split(',').filter(Boolean) || [],
    [searchParams]
  );
  const employeeFilter = useMemo(
    () => searchParams.get('employee')?.split(',').filter(Boolean) || [],
    [searchParams]
  );

  // Function to update search query in URL
  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    setSearchParams(params, { replace: true });
  };

  // Function to apply filters and sync to URL (called when "Áp Dụng" is clicked)
  const handleApplyFilters = (status: string[], priority: string[], employee: string[]) => {
    const params = new URLSearchParams(searchParams);

    if (status.length > 0) {
      params.set('status', status.join(','));
    } else {
      params.delete('status');
    }

    if (priority.length > 0) {
      params.set('priority', priority.join(','));
    } else {
      params.delete('priority');
    }

    if (employee.length > 0) {
      params.set('employee', employee.join(','));
    } else {
      params.delete('employee');
    }

    setSearchParams(params, { replace: true });
  };

  // Fetch service orders using useQuery with filters
  const { data: serviceOrders = [], isLoading } = useQuery<ServiceOrderWithDetails[]>({
    queryKey: ['serviceOrders', searchQuery, statusFilter, priorityFilter, employeeFilter],
    queryFn: async () => {
      // Build filters object for API call
      const filters = {
        search: searchQuery || undefined,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        priority: priorityFilter.length > 0 ? priorityFilter : undefined,
        // Pass employee filter as array
        employee: employeeFilter.length > 0 ? employeeFilter : undefined,
      };

      const response: any = await apiClient.serviceOrders.getAll(1, 100, filters);
      return response.data || [];
    },
  });

  // Fetch motorcycles using useQuery
  const { data: allMotorcycles = [] } = useQuery({
    queryKey: ['motorcycles'],
    queryFn: async () => {
      const response: any = await apiClient.bikes.getAll(1, 100);
      return response.data || [];
    },
  });

  // Fetch customers using useQuery
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response: any = await apiClient.customers.getAll(1, 100);
      return response.data || [];
    },
  });

  // Fetch employees using useQuery
  const { data: employees = [] } = useQuery<UserProfile[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const response: any = await apiClient.users.getEmployees();
      return response || [];
    },
  });

  // Create service order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: ServiceOrderFormData) => {
      const payload: any = {
        motorcycle_id: data.motorcycle_id,
        customer_id: data.customer_id,
        assigned_employee_id: data.assigned_employee_id,
        priority: data.priority,
        description: data.description,
        customer_demand: data.customer_demand,
        mileage_in: data.mileage_in ? parseInt(data.mileage_in) : undefined,
        estimated_completion_date: data.estimated_completion_date,
      };
      return apiClient.serviceOrders.create(payload);
    },
    onSuccess: () => {
      // Invalidate and refetch service orders
      queryClient.invalidateQueries({ queryKey: ['serviceOrders'] });
      setIsSheetOpen(false);
    },
  });

  const handleCreateOrder = async (data: ServiceOrderFormData) => {
    await createOrderMutation.mutateAsync(data);
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/service-orders/${orderId}`);
  };

  // All filtering is now done server-side, so we can use serviceOrders directly
  const filteredServiceOrders = serviceOrders;

  const columns = createServiceOrderColumns(handleViewOrder);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Service Orders</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Quản lý đơn hàng sửa chữa xe
        </p>
      </div>

      <ServiceOrderToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        employeeFilter={employeeFilter}
        employees={employees}
        onCreateOrder={() => setIsSheetOpen(true)}
        isFilterOpen={isFilterOpen}
        onFilterOpenChange={setIsFilterOpen}
        onApplyFilters={handleApplyFilters}
      />

      <ServiceOrderTable
        data={filteredServiceOrders}
        columns={columns}
        isLoading={isLoading}
      />

      {/* Create Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="px-6">
            <SheetTitle>Tạo Service Order Mới</SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-6">
            <ServiceOrderForm
              allMotorcycles={allMotorcycles}
              customers={customers}
              employees={employees}
              onSubmit={handleCreateOrder}
              onCancel={() => setIsSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
