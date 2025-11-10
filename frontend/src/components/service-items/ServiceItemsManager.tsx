import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api-client';
import type { ServiceItem, ServiceStatus } from '../../types';
import { Button } from '../ui/button';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { ServiceItemForm } from './ServiceItemForm';
import { ServiceItemCard } from './ServiceItemCard';
import { toast } from 'sonner';

interface ServiceItemsManagerProps {
  serviceOrderId: string;
}

export function ServiceItemsManager({ serviceOrderId }: ServiceItemsManagerProps) {
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);

  useEffect(() => {
    loadServiceItems();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`service-items-${serviceOrderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_items',
          filter: `service_order_id=eq.${serviceOrderId}`,
        },
        () => {
          loadServiceItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceOrderId]);

  const loadServiceItems = async () => {
    try {
      const data: any = await apiClient.serviceItems.getAll(serviceOrderId);
      setServiceItems(data || []);
    } catch (error) {
      console.error('Error loading service items:', error);
      toast.error('Failed to load service items');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await apiClient.serviceItems.delete(id);
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting service item:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleEdit = (item: ServiceItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const getStatusColor = (status: ServiceStatus): string => {
    const colors: Record<ServiceStatus, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      in_progress: 'bg-purple-500',
      waiting_parts: 'bg-orange-500',
      waiting_approval: 'bg-amber-500',
      quality_check: 'bg-indigo-500',
      completed: 'bg-green-500',
      ready_for_pickup: 'bg-teal-500',
      delivered: 'bg-gray-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: ServiceStatus): string => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const calculateProgress = () => {
    if (serviceItems.length === 0) return 0;
    const completed = serviceItems.filter(item => item.status === 'completed').length;
    return (completed / serviceItems.length) * 100;
  };

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  const progress = calculateProgress();

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold">Service Tasks</h3>
          <p className="text-sm text-muted-foreground">
            {serviceItems.length} task{serviceItems.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
          Add Task
        </Button>
      </div>

      {serviceItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {serviceItems.filter(i => i.status === 'completed').length} of {serviceItems.length} complete
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {serviceItems.map((item) => (
          <ServiceItemCard
            key={item.id}
            item={item}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getStatusColor={getStatusColor}
            getStatusLabel={getStatusLabel}
          />
        ))}
      </div>

      {isFormOpen && (
        <ServiceItemForm
          serviceOrderId={serviceOrderId}
          item={editingItem}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
