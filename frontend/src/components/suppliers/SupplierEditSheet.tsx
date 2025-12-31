import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { suppliersApi, type Supplier, type UpdateSupplierDto } from '@/lib/api/suppliers';
import { toast } from 'sonner';

interface SupplierFormData {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
}

interface SupplierEditSheetProps {
  supplier: Supplier;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupplierEditSheet({ supplier, isOpen, onClose, onSuccess }: SupplierEditSheetProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<SupplierFormData>({
    defaultValues: {
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active,
    },
  });

  const isActive = watch('is_active');

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSupplierDto) => suppliersApi.update(supplier.id, data),
    onSuccess: () => {
      toast.success('Cập nhật thông tin nhà cung cấp thành công');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật thông tin nhà cung cấp');
    },
  });

  const onSubmit = (data: SupplierFormData) => {
    // Convert empty strings to undefined for optional fields
    const payload: UpdateSupplierDto = {
      name: data.name,
      contact_person: data.contact_person?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      is_active: data.is_active,
    };

    updateMutation.mutate(payload);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Chỉnh sửa thông tin nhà cung cấp</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...register('name', {
                required: 'Vui lòng nhập tên nhà cung cấp',
              })}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_person">Người liên hệ</Label>
            <Input
              id="contact_person"
              {...register('contact_person')}
              placeholder="Tên người liên hệ"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              placeholder="Số điện thoại liên hệ"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email', {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Địa chỉ email không hợp lệ',
                },
              })}
              placeholder="Email liên hệ"
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Địa chỉ</Label>
            <Textarea
              id="address"
              {...register('address')}
              placeholder="Địa chỉ nhà cung cấp"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Ghi chú về nhà cung cấp..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Trạng thái hoạt động</Label>
              <div className="text-sm text-muted-foreground">
                {isActive ? 'Nhà cung cấp đang hoạt động' : 'Nhà cung cấp ngừng hoạt động'}
              </div>
            </div>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue('is_active', checked)}
            />
          </div>

          <SheetFooter className="px-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
