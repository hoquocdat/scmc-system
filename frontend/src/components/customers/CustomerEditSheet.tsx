import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import PhoneInput from 'react-phone-number-input';
import { apiClient } from '../../lib/api-client';
import type { Customer, UserProfile } from '../../types';
import { EmployeeSelect } from '../forms/EmployeeSelect';

interface CustomerFormData {
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  id_number?: string;
  birthday?: string;
  facebook?: string;
  instagram?: string;
  salesperson_id?: string;
}

interface CustomerEditSheetProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function CustomerEditSheet({ customer, isOpen, onClose, onSuccess, onError }: CustomerEditSheetProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    control,
  } = useForm<CustomerFormData>({
    defaultValues: {
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
      id_number: customer.id_number || '',
      birthday: customer.birthday ? customer.birthday.split('T')[0] : '',
      facebook: customer.facebook || '',
      instagram: customer.instagram || '',
      salesperson_id: customer.salesperson_id || '',
    },
  });

  const { data: employees = [] } = useQuery<UserProfile[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const result: any = await apiClient.users.getEmployees();
      return result || [];
    },
  });


  const onSubmit = async (data: CustomerFormData) => {
    try {
      // Convert empty strings to undefined for all optional fields
      const payload = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email?.trim() || undefined,
        address: data.address?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        id_number: data.id_number?.trim() || undefined,
        birthday: data.birthday || undefined,
        facebook: data.facebook?.trim() || undefined,
        instagram: data.instagram?.trim() || undefined,
        salesperson_id: data.salesperson_id || undefined,
      };

      await apiClient.customers.update(customer.id, payload);

      onSuccess();
      onClose();
    } catch (err: any) {
      // Check if it's a phone duplicate error
      if (err.message?.includes('số điện thoại') || err.message?.includes('phone')) {
        setFormError('phone', {
          message: err.message || 'Số điện thoại này đã được sử dụng',
        });
      } else {
        setFormError('root', {
          message: err.message || 'Failed to update customer',
        });
      }
      onError('Không thể cập nhật thông tin khách hàng');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Chỉnh Sửa Thông Tin Khách Hàng</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errors.root && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.root.message}
              </div>
            )}

            {/* Customer Fields */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Họ Tên *</Label>
              <Input
                id="full_name"
                {...register('full_name', {
                  required: 'Vui lòng nhập họ tên',
                })}
              />
              {errors.full_name && (
                <p className="text-sm text-red-600">{errors.full_name.message}</p>
              )}
            </div>

            {/* Contact Fields */}
            <div className="space-y-2">
              <Label htmlFor="phone">Số Điện Thoại *</Label>
              <Controller
                name="phone"
                control={control}
                rules={{
                  required: 'Vui lòng nhập số điện thoại',
                  validate: async (value) => {
                    if (!value) return true;
                    // Skip validation if phone hasn't changed
                    if (value === customer.phone) return true;
                    try {
                      const result: any = await apiClient.customers.checkPhone(value);
                      return result.available || 'Số điện thoại này đã được sử dụng';
                    } catch (error) {
                      console.error('Error checking phone:', error);
                      return true; // Allow submission if check fails
                    }
                  },
                }}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    defaultCountry="VN"
                    placeholder="Nhập số điện thoại"
                    international
                    className="PhoneInput"
                  />
                )}
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
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
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_number">Số CMND/CCCD</Label>
              <Input id="id_number" {...register('id_number')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthday">Ngày Sinh</Label>
              <Input
                id="birthday"
                type="date"
                {...register('birthday')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                placeholder="Facebook username hoặc URL"
                {...register('facebook')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                placeholder="Instagram username hoặc URL"
                {...register('instagram')}
              />
            </div>

            <EmployeeSelect
              control={control}
              name="salesperson_id"
              employees={employees}
              label="Nhân Viên Phụ Trách"
              placeholder="Chọn nhân viên phụ trách..."
            />

            <div className="space-y-2">
              <Label htmlFor="address">Địa Chỉ</Label>
              <Textarea
                id="address"
                {...register('address')}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Ghi Chú</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                className="min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
