import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';

interface ServiceDescriptionCardProps {
  customerDemand?: string;
  description?: string;
  onDescriptionUpdate: (description: string) => Promise<void>;
}

interface DescriptionFormData {
  description?: string;
}

export function ServiceDescriptionCard({
  customerDemand,
  description,
  onDescriptionUpdate,
}: ServiceDescriptionCardProps) {
  const { t } = useTranslation();
  const [isDescriptionSheetOpen, setIsDescriptionSheetOpen] = useState(false);
  const descriptionForm = useForm<DescriptionFormData>();

  const handleDescriptionSheetOpen = () => {
    descriptionForm.reset({
      description: description || '',
    });
    setIsDescriptionSheetOpen(true);
  };

  const onDescriptionSubmit = async (data: DescriptionFormData) => {
    try {
      await onDescriptionUpdate(data.description || '');
      setIsDescriptionSheetOpen(false);
    } catch (error) {
      // Error handling is done in parent component
      console.error('Error updating description:', error);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {customerDemand && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Yêu Cầu Khách Hàng
            </label>
            <p className="mt-1 p-3 bg-slate-50 rounded border">
              {customerDemand}
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('serviceOrders.serviceDescription')}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDescriptionSheetOpen}
              className="h-7 text-xs"
            >
              Chỉnh Sửa
            </Button>
          </div>
          {description ? (
            <p className="mt-1 p-3 bg-slate-50 rounded border">
              {description}
            </p>
          ) : (
            <p className="mt-1 p-3 bg-slate-50 rounded border text-muted-foreground italic">
              Chưa có mô tả
            </p>
          )}
        </div>
      </div>

      {/* Description Edit Sheet */}
      <Sheet open={isDescriptionSheetOpen} onOpenChange={setIsDescriptionSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader className="px-6">
            <SheetTitle>Chỉnh Sửa Mô Tả</SheetTitle>
          </SheetHeader>
          <form onSubmit={descriptionForm.handleSubmit(onDescriptionSubmit)} className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Mô Tả Dịch Vụ</Label>
              <Textarea
                id="description"
                {...descriptionForm.register('description')}
                placeholder="Mô tả công việc cần thực hiện"
                className="min-h-[200px]"
              />
            </div>
          </form>
          <div className="px-6 pb-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDescriptionSheetOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={descriptionForm.formState.isSubmitting}
              onClick={descriptionForm.handleSubmit(onDescriptionSubmit)}
            >
              {descriptionForm.formState.isSubmitting ? 'Đang cập nhật...' : 'Cập Nhật'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
