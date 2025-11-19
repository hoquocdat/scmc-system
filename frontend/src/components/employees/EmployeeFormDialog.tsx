import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import type { UserProfile, UserRole } from '@/types';

interface EmployeeFormData {
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
}

interface EmployeeFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  editingEmployee: UserProfile | null;
}

export function EmployeeFormDialog({
  isOpen,
  onClose,
  onSubmit,
  editingEmployee,
}: EmployeeFormDialogProps) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<EmployeeFormData>({
    defaultValues: {
      full_name: editingEmployee?.full_name || '',
      email: editingEmployee?.email || '',
      phone: editingEmployee?.phone || '',
      password: '',
      role: editingEmployee?.role || 'employee',
    },
  });

  const selectedRole = watch('role');

  const handleFormSubmit = async (data: EmployeeFormData) => {
    await onSubmit(data);
    reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingEmployee ? 'Sửa Nhân Viên' : 'Thêm Nhân Viên Mới'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {errors.root && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.root.message}
            </div>
          )}

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

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register('email', {
                required: 'Vui lòng nhập email',
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
            <Label htmlFor="role">Vai Trò *</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as UserRole)}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Nhân Viên</SelectItem>
                <SelectItem value="sales">Bán Hàng</SelectItem>
                <SelectItem value="manager">Quản Lý</SelectItem>
                <SelectItem value="finance">Tài Chính</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!editingEmployee && (
            <div className="space-y-2">
              <Label htmlFor="password">Mật Khẩu *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: editingEmployee ? false : 'Vui lòng nhập mật khẩu',
                    minLength: {
                      value: 6,
                      message: 'Mật khẩu phải có ít nhất 6 ký tự',
                    },
                  })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Số Điện Thoại</Label>
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
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
              {isSubmitting ? 'Đang lưu...' : 'Lưu Nhân Viên'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
