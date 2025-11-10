import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/card';
import { WorkFilters } from '@/components/employee-work/WorkFilters';
import { WorkOrderCard } from '@/components/employee-work/WorkOrderCard';
import type { ServiceStatus, PriorityLevel } from '../types';
import { toast } from 'sonner';

interface AssignedOrder {
  id: string;
  order_number: string;
  status: ServiceStatus;
  priority: PriorityLevel;
  estimated_completion_date: string;
  motorcycle: {
    license_plate: string;
    brand: string;
    model: string;
  };
  owner_name: string;
  customer_name: string;
  total_tasks: number;
  completed_tasks: number;
}

export function EmployeeWorkPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Fetch assigned orders with useQuery
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['employee-work', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get service orders assigned to this employee
      const { data: ordersData, error: ordersError } = await supabase
        .from('service_orders')
        .select(`
          id,
          order_number,
          status,
          priority,
          estimated_completion_date,
          bikes (
            license_plate,
            brand,
            model,
            bike_owners (
              owner_type,
              full_name,
              company_name
            )
          ),
          customers (
            full_name
          )
        `)
        .eq('assigned_employee_id', user.id)
        .not('status', 'in', '(delivered,cancelled)')
        .order('priority', { ascending: false })
        .order('estimated_completion_date', { ascending: true });

      if (ordersError) throw ordersError;

      // Get task counts for each order
      const ordersWithTasks = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          const { data: itemsData } = await supabase
            .from('service_items')
            .select('id, status')
            .eq('service_order_id', order.id);

          const totalTasks = itemsData?.length || 0;
          const completedTasks = itemsData?.filter(item => item.status === 'completed').length || 0;

          const ownerName = order.bikes.bike_owners.owner_type === 'individual'
            ? order.bikes.bike_owners.full_name
            : order.bikes.bike_owners.company_name;

          return {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            priority: order.priority,
            estimated_completion_date: order.estimated_completion_date,
            motorcycle: {
              license_plate: order.bikes.license_plate,
              brand: order.bikes.brand,
              model: order.bikes.model,
            },
            owner_name: ownerName,
            customer_name: order.customers.full_name,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
          };
        })
      );

      return ordersWithTasks as AssignedOrder[];
    },
    enabled: !!user,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('employee-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_orders',
          filter: `assigned_employee_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_items',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  const updateOrderStatus = async (orderId: string, newStatus: ServiceStatus) => {
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && order.priority !== priorityFilter) return false;
    return true;
  });

  const handleClearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center py-12">Loading your assigned work...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Assigned Work</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {filteredOrders.length} active service order{filteredOrders.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {/* Filters */}
      <WorkFilters
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onClearFilters={handleClearFilters}
      />

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              {orders.length === 0
                ? 'No service orders assigned to you yet.'
                : 'No orders match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filteredOrders.map((order) => (
            <WorkOrderCard
              key={order.id}
              order={order}
              onViewDetails={(orderId) => navigate(`/service-orders/${orderId}`)}
              onUpdateStatus={updateOrderStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
