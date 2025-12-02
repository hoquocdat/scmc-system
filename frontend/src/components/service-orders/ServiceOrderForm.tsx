import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { CustomerSelect, BikeSelect, EmployeeSelect } from '@/components/forms/CustomSelects';
import { aiApi, type GeneratedTask } from '@/lib/api/ai';
import { Sparkles, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, UserProfile } from '@/types';

export interface ServiceOrderFormData {
  motorcycle_id: string;
  customer_id: string;
  assigned_employee_id?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  description?: string;
  customer_demand?: string;
  mileage_in?: string;
  estimated_completion_date?: string;
  generated_tasks?: GeneratedTask[];
}

interface ServiceOrderFormProps {
  allMotorcycles: any[];
  customers: Customer[];
  employees: UserProfile[];
  onSubmit: (data: ServiceOrderFormData) => Promise<void>;
  onCancel: () => void;
}

export function ServiceOrderForm({
  allMotorcycles,
  customers,
  employees,
  onSubmit,
  onCancel,
}: ServiceOrderFormProps) {
  const [filteredMotorcycles, setFilteredMotorcycles] = useState<any[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<Set<number>>(new Set());
  const [aiSummary, setAiSummary] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    watch,
    setValue,
    control,
  } = useForm<ServiceOrderFormData>({
    defaultValues: {
      motorcycle_id: '',
      customer_id: '',
      assigned_employee_id: '',
      priority: 'normal',
      description: '',
      customer_demand: '',
      mileage_in: '',
      estimated_completion_date: '',
    },
  });

  const customerId = watch('customer_id');
  const motorcycleId = watch('motorcycle_id');
  const customerDemand = watch('customer_demand');

  // AI task generation mutation
  const generateTasksMutation = useMutation({
    mutationFn: aiApi.generateTasks,
    onSuccess: (data) => {
      setGeneratedTasks(data.tasks);
      setAiSummary(data.summary);
      // Select all tasks by default
      setSelectedTaskIndexes(new Set(data.tasks.map((_, i) => i)));
      toast.success(`AI đã tạo ${data.tasks.length} công việc`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể tạo công việc từ AI');
    },
  });

  // Watch for customer changes and filter motorcycles
  useEffect(() => {
    if (customerId) {
      const motorcyclesForCustomer = allMotorcycles.filter(
        (moto) => moto.owner_id === customerId
      );
      setFilteredMotorcycles(motorcyclesForCustomer);
      setValue('motorcycle_id', '');
    } else {
      setFilteredMotorcycles([]);
    }
  }, [customerId, allMotorcycles, setValue]);

  // Helper to strip HTML tags and check if content has text
  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const hasCustomerDemandContent = customerDemand && stripHtml(customerDemand).trim().length > 0;

  const handleGenerateTasks = () => {
    if (!hasCustomerDemandContent) {
      toast.error('Vui lòng nhập yêu cầu khách hàng trước');
      return;
    }

    const selectedMotorcycle = filteredMotorcycles.find(m => m.id === motorcycleId);

    // Send plain text to AI for better processing
    generateTasksMutation.mutate({
      customer_demand: stripHtml(customerDemand || ''),
      bike_brand: selectedMotorcycle?.brand,
      bike_model: selectedMotorcycle?.model,
      bike_year: selectedMotorcycle?.year,
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

  const handleFormSubmit = async (data: ServiceOrderFormData) => {
    try {
      // Include selected tasks
      const selectedTasks = generatedTasks.filter((_, i) => selectedTaskIndexes.has(i));
      await onSubmit({
        ...data,
        generated_tasks: selectedTasks.length > 0 ? selectedTasks : undefined,
      });
    } catch (err: any) {
      setFormError('root', {
        message: err.message || 'Failed to create service order',
      });
    }
  };

  const selectedMotorcycle = filteredMotorcycles.find(m => m.id === motorcycleId);
  const selectedCustomer = customers.find(c => c.id === customerId);


  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {errors.root && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errors.root.message}
        </div>
      )}

      {/* Step 1: Customer Selection */}
      <CustomerSelect
        control={control}
        name="customer_id"
        customers={customers}
        error={errors.customer_id?.message}
        required
        selectedCustomer={selectedCustomer}
      />

      {/* Step 2: Bike Selection */}
      <BikeSelect
        control={control}
        name="motorcycle_id"
        motorcycles={filteredMotorcycles}
        error={errors.motorcycle_id?.message}
        required
        disabled={!customerId}
        customerId={customerId}
        selectedCustomerName={selectedCustomer?.full_name}
        selectedMotorcycle={selectedMotorcycle}
      />

      {/* Priority and Employee */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Độ Ưu Tiên</Label>
          <select
            id="priority"
            {...register('priority')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="low">Thấp</option>
            <option value="normal">Bình thường</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn cấp</option>
          </select>
        </div>

        <EmployeeSelect
          control={control}
          name="assigned_employee_id"
          employees={employees}
        />
      </div>

      {/* Customer Demand with AI Button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="customer_demand">Yêu Cầu Khách Hàng</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateTasks}
            disabled={generateTasksMutation.isPending || !hasCustomerDemandContent}
            className="gap-2"
          >
            {generateTasksMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Tạo Tasks với AI
          </Button>
        </div>
        <Controller
          name="customer_demand"
          control={control}
          render={({ field }) => (
            <TiptapEditor
              content={field.value || ''}
              onChange={field.onChange}
              placeholder="Khách hàng yêu cầu gì? (VD: Thay nhớt, kiểm tra phanh, xe bị rung khi chạy nhanh...)"
            />
          )}
        />
      </div>

      {/* AI Generated Tasks Preview */}
      {generatedTasks.length > 0 && (
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
            <p className="text-xs text-muted-foreground pt-2">
              Chọn các công việc bạn muốn thêm vào Service Order. Bạn có thể chỉnh sửa sau khi tạo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Description - temporarily hidden
      <div className="space-y-2">
        <Label htmlFor="description">Mô Tả Dịch Vụ</Label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TiptapEditor
              content={field.value || ''}
              onChange={field.onChange}
              placeholder="Ghi chú thêm về dịch vụ..."
            />
          )}
        />
      </div>
      */}

      {/* Mileage and Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mileage_in">Km Vào (km)</Label>
          <Input
            id="mileage_in"
            type="number"
            {...register('mileage_in', {
              min: {
                value: 0,
                message: 'Km phải lớn hơn hoặc bằng 0',
              },
            })}
            placeholder="0"
          />
          {errors.mileage_in && (
            <p className="text-sm text-red-600">{errors.mileage_in.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated_completion_date">Ngày Hoàn Thành Dự Kiến</Label>
          <Input
            id="estimated_completion_date"
            type="date"
            {...register('estimated_completion_date')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo...' : 'Tạo Service Order'}
        </Button>
      </div>
    </form>
  );
}
