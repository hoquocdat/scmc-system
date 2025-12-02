import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import ReactSelect from 'react-select';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { ServiceOrderHeader } from '../components/service-orders/ServiceOrderHeader';
import { ServiceOrderOverviewTab } from '../components/service-orders/ServiceOrderOverviewTab';
import { ServiceOrderImagesTab } from '../components/service-orders/ServiceOrderImagesTab';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { ServiceItemsManager } from '../components/service-items/ServiceItemsManager';
import { ActivityTimeline } from '../components/activity/ActivityTimeline';
import { PartsUsageManager } from '../components/parts/PartsUsageManager';
import { CommentsSection } from '../components/comments/CommentsSection';
import type { ServiceStatus } from '../types';

// Custom styles for react-select
const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '36px',
    borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
    boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
    '&:hover': {
      borderColor: 'hsl(var(--input))',
    },
    backgroundColor: 'transparent',
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 100,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
    color: state.isFocused ? 'hsl(var(--accent-foreground))' : 'inherit',
    '&:active': {
      backgroundColor: 'hsl(var(--accent))',
    },
  }),
};

// Custom option component for employees
const EmployeeOption = (props: any) => {
  const { data, innerRef, innerProps } = props;
  return (
    <div ref={innerRef} {...innerProps} className="px-3 py-2 cursor-pointer hover:bg-accent">
      <div className="font-medium">{data.label}</div>
      {data.phone && <div className="text-sm text-muted-foreground">{data.phone}</div>}
    </div>
  );
};

// Custom single value component for employees
const EmployeeSingleValue = (props: any) => {
  const { data } = props;
  return (
    <div className="flex items-center">
      <div>
        <div className="font-medium text-sm">{data.label}</div>
        {data.phone && <div className="text-xs text-muted-foreground">{data.phone}</div>}
      </div>
    </div>
  );
};

interface EmployeeFormData {
  assigned_employee_id?: string;
}



export function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useUrlTabs('overview');
  const [isEmployeeSheetOpen, setIsEmployeeSheetOpen] = useState(false);
  const [isUnderDevelopmentOpen, setIsUnderDevelopmentOpen] = useState(false);
  const queryClient = useQueryClient();

  const employeeForm = useForm<EmployeeFormData>();

  // Fetch service order with related data
  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: async () => {
      // Fetch service order
      const orderData: any = await apiClient.serviceOrders.getOne(id!);

      // Fetch related data
      const [bikeData, customerData, employeeData] = await Promise.all([
        orderData.motorcycle_id ? apiClient.bikes.getOne(orderData.motorcycle_id).catch(() => null) : null,
        orderData.customer_id ? apiClient.customers.getOne(orderData.customer_id).catch(() => null) : null,
        orderData.assigned_employee_id ? apiClient.users.getOne(orderData.assigned_employee_id).catch(() => null) : null,
      ]);

      // Fetch owner data if bike exists
      let ownerData = null;
      if (bikeData && (bikeData as any).owner_id) {
        ownerData = await apiClient.customers.getOne((bikeData as any).owner_id).catch(() => null);
      }

      // Combine data
      return {
        ...orderData,
        bikes: bikeData ? {
          ...bikeData,
          bike_owners: ownerData
        } : null,
        customers: customerData,
        assigned_employee: employeeData,
      };
    },
    enabled: !!id,
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response: any = await apiClient.users.getEmployees();
      return response || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });


  // Mutation for updating service order
  const updateServiceOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiClient.serviceOrders.update(id!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
    },
  });

  const handleEmployeeSheetOpen = () => {
    employeeForm.reset({
      assigned_employee_id: order?.assigned_employee_id || '',
    });
    setIsEmployeeSheetOpen(true);
  };

  const onEmployeeSubmit = async (data: EmployeeFormData) => {
    try {
      await updateServiceOrderMutation.mutateAsync({
        assigned_employee_id: data.assigned_employee_id || null,
      });

      toast.success('Nhân viên phụ trách đã được cập nhật');
      setIsEmployeeSheetOpen(false);
    } catch (err: any) {
      console.error('Error updating employee:', err);
      toast.error('Cập nhật thất bại: ' + err.message);
    }
  };

  const handleDescriptionUpdate = async (description: string) => {
    try {
      await updateServiceOrderMutation.mutateAsync({
        description: description,
      });

      toast.success('Mô tả đã được cập nhật');
    } catch (err: any) {
      console.error('Error updating description:', err);
      toast.error('Cập nhật thất bại: ' + err.message);
      throw err; // Re-throw to let the component handle it
    }
  };

  const handleStatusUpdate = async (newStatus: ServiceStatus) => {
    try {
      const payload: any = {
        status: newStatus,
      };

      // Set completion date if moving to completed
      if (newStatus === 'completed' && !order?.actual_completion_date) {
        payload.actual_completion_date = new Date().toISOString();
      }

      await updateServiceOrderMutation.mutateAsync(payload);

      toast.success('Trạng thái đã được cập nhật');
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error('Cập nhật thất bại: ' + err.message);
      throw err; // Re-throw to let the component handle it
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'parts') {
      setIsUnderDevelopmentOpen(true);
    } else {
      setActiveTab(value);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center py-12">{t('common.loading')}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">{t('serviceOrders.orderNotFound')}</p>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/service-orders')}>
                {t('serviceOrders.backToServiceOrders')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <ServiceOrderHeader
        orderNumber={order.order_number}
        createdAt={order.created_at}
        status={order.status}
        priority={order.priority}
        onStatusUpdate={handleStatusUpdate}
      />

      {/* Main Content with Tabs */}
      <div className="space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-6 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">{t('serviceOrders.overview')}</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm">{t('serviceOrders.tasks')}</TabsTrigger>
            <TabsTrigger value="parts" className="text-xs sm:text-sm">{t('serviceOrders.parts')}</TabsTrigger>
            <TabsTrigger value="images" className="text-xs sm:text-sm">Hình Ảnh</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs sm:text-sm hidden md:block">{t('comments.title')}</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm hidden md:block">{t('serviceOrders.activity')}</TabsTrigger>
          </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <ServiceOrderOverviewTab
                order={order}
                onEmployeeEdit={handleEmployeeSheetOpen}
                onDescriptionUpdate={handleDescriptionUpdate}
              />
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks">
              <ServiceItemsManager
                serviceOrderId={order.id}
                customerDemand={order.customer_demand}
                bikeBrand={order.bikes?.brand}
                bikeModel={order.bikes?.model}
                bikeYear={order.bikes?.year}
              />
            </TabsContent>

            {/* Parts Tab */}
            <TabsContent value="parts">
              <PartsUsageManager serviceOrderId={order.id} />
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images">
              <ServiceOrderImagesTab
                serviceOrderId={order.id}
                orderNumber={order.order_number}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['service-order', id] })}
              />
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments">
              <CommentsSection serviceOrderId={order.id} />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>{t('serviceOrders.activityLog')}</CardTitle>
                  <CardDescription>
                    {t('serviceOrders.activityDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityTimeline entityType="service_order" entityId={order.id} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Employee Assignment Sheet */}
        <Sheet open={isEmployeeSheetOpen} onOpenChange={setIsEmployeeSheetOpen}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Phân Công Nhân Viên</SheetTitle>
            </SheetHeader>
            <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4 mt-6 px-4">
              <div className="space-y-2">
                <Label>Chọn Nhân Viên</Label>
                <Controller
                  name="assigned_employee_id"
                  control={employeeForm.control}
                  render={({ field }) => {
                    const employeeOptions = employees.map((employee: any) => ({
                      value: employee.id,
                      label: employee.full_name,
                      phone: employee.phone,
                    }));
                    return (
                      <ReactSelect
                        {...field}
                        options={employeeOptions}
                        value={employeeOptions.find((option: any) => option.value === field.value) || null}
                        onChange={(option: any) => field.onChange(option?.value || '')}
                        placeholder="Chọn nhân viên..."
                        isClearable
                        styles={selectStyles}
                        components={{
                          Option: EmployeeOption,
                          SingleValue: EmployeeSingleValue,
                        }}
                        noOptionsMessage={() => 'Không tìm thấy nhân viên'}
                      />
                    );
                  }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEmployeeSheetOpen(false)}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={employeeForm.formState.isSubmitting}>
                  {employeeForm.formState.isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật'}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>

        {/* Under Development Dialog */}
        <Dialog open={isUnderDevelopmentOpen} onOpenChange={setIsUnderDevelopmentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tính năng đang phát triển</DialogTitle>
              <DialogDescription>
                Tính năng quản lý phụ tùng hiện đang trong quá trình phát triển và sẽ sớm được ra mắt.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setIsUnderDevelopmentOpen(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </div>
  );
}
