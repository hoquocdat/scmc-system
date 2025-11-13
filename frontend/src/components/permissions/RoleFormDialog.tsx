import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { permissionsApi, type Role, type CreateRoleDto } from '@/lib/api/permissions';
import { toast } from 'sonner';

const roleSchema = z.object({
  name: z.string().min(1, 'Tên vai trò là bắt buộc').max(100, 'Tên vai trò quá dài'),
  description: z.string().optional(),
  is_system: z.boolean().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!role;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
      is_system: false,
    },
  });

  // Load role data when editing
  useEffect(() => {
    if (role) {
      setValue('name', role.name);
      setValue('description', role.description || '');
      setValue('is_system', role.is_system);
    } else {
      reset();
    }
  }, [role, setValue, reset]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRoleDto) => permissionsApi.createRole(data),
    onSuccess: () => {
      toast.success('Đã tạo vai trò thành công');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể tạo vai trò');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateRoleDto) => permissionsApi.updateRole(role!.id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật vai trò thành công');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật vai trò');
    },
  });

  const onSubmit = (data: RoleFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isSystemRole = watch('is_system');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Chỉnh sửa vai trò' : 'Tạo vai trò mới'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Cập nhật thông tin vai trò'
              : 'Tạo vai trò mới với thông tin bên dưới'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Role Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Tên vai trò <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="vd: warehouse_manager"
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Mô tả vai trò và trách nhiệm..."
              rows={3}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* System Role */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_system" className="text-base">
                Vai trò hệ thống
              </Label>
              <p className="text-sm text-muted-foreground">
                Vai trò hệ thống không thể bị xóa
              </p>
            </div>
            <Switch
              id="is_system"
              checked={isSystemRole}
              onCheckedChange={(checked) => setValue('is_system', checked)}
              disabled={isSubmitting || (isEditMode && role?.is_system)}
            />
          </div>

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : isEditMode ? (
                'Cập nhật'
              ) : (
                'Tạo vai trò'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
