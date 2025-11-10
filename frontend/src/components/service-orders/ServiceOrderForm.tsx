import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerSelect, BikeSelect, EmployeeSelect } from '@/components/forms/CustomSelects';
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

  // Watch for customer changes and filter motorcycles
  useEffect(() => {
    if (customerId) {
      const motorcyclesForCustomer = allMotorcycles.filter(
        (moto) => moto.owner_id === customerId
      );
      setFilteredMotorcycles(motorcyclesForCustomer);
      // Reset motorcycle selection when customer changes
      setValue('motorcycle_id', '');
    } else {
      setFilteredMotorcycles([]);
    }
  }, [customerId, allMotorcycles, setValue]);

  const handleFormSubmit = async (data: ServiceOrderFormData) => {
    try {
      await onSubmit(data);
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

      {/* Customer Demand */}
      <div className="space-y-2">
        <Label htmlFor="customer_demand">Yêu Cầu Khách Hàng</Label>
        <textarea
          id="customer_demand"
          {...register('customer_demand')}
          placeholder="Khách hàng yêu cầu gì?"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Mô Tả Dịch Vụ</Label>
        <textarea
          id="description"
          {...register('description')}
          placeholder="Mô tả công việc cần thực hiện"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

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
