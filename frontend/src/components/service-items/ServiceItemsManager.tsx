import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api-client';
import { aiApi, type GeneratedTask } from '../../lib/api/ai';
import type { ServiceItem, ServiceStatus } from '../../types';
import { Button } from '../ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { ServiceItemForm } from './ServiceItemForm';
import { ServiceItemCard } from './ServiceItemCard';
import { toast } from 'sonner';
import { Sparkles, Loader2, Trash2 } from 'lucide-react';

interface ServiceItemsManagerProps {
  serviceOrderId: string;
  customerDemand?: string;
  bikeBrand?: string;
  bikeModel?: string;
  bikeYear?: number;
}

export function ServiceItemsManager({
  serviceOrderId,
  customerDemand,
  bikeBrand,
  bikeModel,
  bikeYear,
}: ServiceItemsManagerProps) {
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

  // AI Preview state
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<Set<number>>(new Set());
  const [aiSummary, setAiSummary] = useState<string>('');

  // Helper to strip HTML tags
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // AI task generation mutation
  const generateTasksMutation = useMutation({
    mutationFn: aiApi.generateTasks,
    onSuccess: (data) => {
      if (data.tasks.length === 0) {
        toast.info('AI không tạo được công việc từ yêu cầu này');
        return;
      }

      // Show preview instead of creating immediately
      setGeneratedTasks(data.tasks);
      setAiSummary(data.summary);
      // Select all tasks by default
      setSelectedTaskIndexes(new Set(data.tasks.map((_, i) => i)));
      toast.success(`AI đã tạo ${data.tasks.length} công việc. Vui lòng xem và xác nhận.`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể tạo công việc từ AI');
    },
  });

  const handleGenerateTasksWithAI = () => {
    if (!customerDemand) {
      toast.error('Không có yêu cầu khách hàng để tạo công việc');
      return;
    }

    generateTasksMutation.mutate({
      customer_demand: stripHtml(customerDemand),
      bike_brand: bikeBrand,
      bike_model: bikeModel,
      bike_year: bikeYear,
    });
  };

  const toggleTaskSelection = (index: number) => {
    setSelectedTaskIndexes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const removeTask = (index: number) => {
    setGeneratedTasks(prev => prev.filter((_, i) => i !== index));
    setSelectedTaskIndexes(prev => {
      const newSet = new Set<number>();
      prev.forEach(i => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  };

  const handleConfirmTasks = async () => {
    const selectedTasks = generatedTasks.filter((_, i) => selectedTaskIndexes.has(i));
    if (selectedTasks.length === 0) {
      toast.error('Vui lòng chọn ít nhất một công việc');
      return;
    }

    setIsCreatingTasks(true);
    try {
      for (const task of selectedTasks) {
        await apiClient.serviceItems.create({
          service_order_id: serviceOrderId,
          name: task.name,
          description: task.description,
          status: 'pending',
        });
      }
      toast.success(`Đã tạo ${selectedTasks.length} công việc`);
      setGeneratedTasks([]);
      setSelectedTaskIndexes(new Set());
      setAiSummary('');
      loadServiceItems();
    } catch (error) {
      console.error('Error creating service items:', error);
      toast.error('Không thể tạo công việc');
    } finally {
      setIsCreatingTasks(false);
    }
  };

  const handleCancelPreview = () => {
    setGeneratedTasks([]);
    setSelectedTaskIndexes(new Set());
    setAiSummary('');
  };

  const canGenerateWithAI = customerDemand && stripHtml(customerDemand).trim().length > 0;
  const isAILoading = generateTasksMutation.isPending;
  const hasPreview = generatedTasks.length > 0;

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

      {/* AI Generated Tasks Preview */}
      {hasPreview && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Công việc được AI đề xuất
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {selectedTaskIndexes.size} / {generatedTasks.length} đã chọn
              </span>
            </div>
            {aiSummary && (
              <p className="text-sm text-muted-foreground mt-1">{aiSummary}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {generatedTasks.map((task, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  selectedTaskIndexes.has(index)
                    ? 'bg-background border-primary/30'
                    : 'bg-muted/30 border-transparent opacity-60'
                }`}
              >
                <Checkbox
                  checked={selectedTaskIndexes.has(index)}
                  onCheckedChange={() => toggleTaskSelection(index)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{task.name}</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.description}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTask(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Chọn các công việc bạn muốn thêm vào Service Order.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelPreview}
                  disabled={isCreatingTasks}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmTasks}
                  disabled={isCreatingTasks || selectedTaskIndexes.size === 0}
                  className="gap-2"
                >
                  {isCreatingTasks ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Xác nhận ({selectedTaskIndexes.size})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state with AI generation button */}
      {serviceItems.length === 0 && canGenerateWithAI && !hasPreview && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
            <h4 className="text-sm font-medium mb-2">Chưa có công việc nào</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Bạn có thể tạo công việc từ yêu cầu khách hàng bằng AI hoặc thêm thủ công.
            </p>
            <Button
              onClick={handleGenerateTasksWithAI}
              disabled={isAILoading}
              className="gap-2"
            >
              {isAILoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Tạo công việc bằng AI
            </Button>
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
