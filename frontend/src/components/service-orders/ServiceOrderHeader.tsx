import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import type { ServiceStatus } from '@/types';

interface ServiceOrderHeaderProps {
  orderNumber: string;
  createdAt: string;
  status: string;
  priority: string;
  onStatusUpdate: (newStatus: ServiceStatus) => Promise<void>;
}

interface StatusFormData {
  status: ServiceStatus;
}

const statusWorkflow: ServiceStatus[] = [
  'pending',
  'confirmed',
  'in_progress',
  'waiting_parts',
  'quality_check',
  'completed',
  'ready_for_pickup',
  'delivered',
];

export function ServiceOrderHeader({
  orderNumber,
  createdAt,
  status,
  priority,
  onStatusUpdate,
}: ServiceOrderHeaderProps) {
  const { t } = useTranslation();
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const statusForm = useForm<StatusFormData>();

  const formatStatusLabel = (status: string) => {
    return t(`serviceOrders.statuses.${status}`);
  };

  const handleStatusSheetOpen = () => {
    statusForm.reset({
      status: status as ServiceStatus,
    });
    setIsStatusSheetOpen(true);
  };

  const onStatusSubmit = async (data: StatusFormData) => {
    try {
      await onStatusUpdate(data.status);
      setIsStatusSheetOpen(false);
    } catch (error) {
      // Error handling is done in parent component
      console.error('Error updating status:', error);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {t('serviceOrders.orderNumber')}{orderNumber}
            </h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {t('serviceOrders.created')} {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Trạng Thái:</span>
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleStatusSheetOpen}>
              <StatusBadge status={status} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Ưu Tiên:</span>
            <PriorityBadge priority={priority} />
          </div>
        </div>
      </div>

      {/* Status Edit Sheet */}
      <Sheet open={isStatusSheetOpen} onOpenChange={setIsStatusSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader className="px-6">
            <SheetTitle>Cập Nhật Trạng Thái</SheetTitle>
          </SheetHeader>
          <form onSubmit={statusForm.handleSubmit(onStatusSubmit)} className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Trạng Thái</Label>
              <select
                id="status"
                {...statusForm.register('status', { required: 'Vui lòng chọn trạng thái' })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {statusWorkflow.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {formatStatusLabel(statusOption)}
                  </option>
                ))}
                <option value="cancelled">
                  {t('serviceOrders.statuses.cancelled')}
                </option>
              </select>
              {statusForm.formState.errors.status && (
                <p className="text-sm text-red-600">{statusForm.formState.errors.status.message}</p>
              )}
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">Trạng thái hiện tại:</p>
              <StatusBadge status={status} />
            </div>
          </form>
          <div className="px-6 pb-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStatusSheetOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={statusForm.formState.isSubmitting}
              onClick={statusForm.handleSubmit(onStatusSubmit)}
            >
              {statusForm.formState.isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
