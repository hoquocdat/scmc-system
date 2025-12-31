import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import {
  attributeDefinitionsApi,
  type AttributeDefinition,
  type CreateAttributeDefinitionDto,
  type AttributeOption,
} from '@/lib/api/attribute-definitions';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useState } from 'react';

interface AttributeDefinitionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attribute?: AttributeDefinition;
  onSuccess?: () => void;
}

export function AttributeDefinitionFormDialog({
  open,
  onOpenChange,
  attribute,
  onSuccess,
}: AttributeDefinitionFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!attribute;
  const [options, setOptions] = useState<AttributeOption[]>(attribute?.options || []);
  const [newOption, setNewOption] = useState({ value: '', label: '', color_code: '' });

  const { register, handleSubmit, formState: { errors }, watch, setValue } =
    useForm<CreateAttributeDefinitionDto>({
      defaultValues: attribute || {
        input_type: 'select',
        data_type: 'string',
        is_variant_attribute: true,
        is_filterable: true,
        is_required: false,
        is_active: true,
        display_order: 0,
      },
    });

  const inputType = watch('input_type');

  const createMutation = useMutation({
    mutationFn: (data: CreateAttributeDefinitionDto) =>
      attributeDefinitionsApi.create(data),
    onSuccess: () => {
      toast.success('Đã tạo thuộc tính');
      queryClient.invalidateQueries({ queryKey: ['attributeDefinitions'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateAttributeDefinitionDto }) =>
      attributeDefinitionsApi.update(id, data),
    onSuccess: () => {
      toast.success('Đã cập nhật thuộc tính');
      queryClient.invalidateQueries({ queryKey: ['attributeDefinitions'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra');
    },
  });

  const handleAddOption = () => {
    if (!newOption.value || !newOption.label) {
      toast.error('Vui lòng nhập giá trị và nhãn');
      return;
    }

    if (inputType === 'color' && !newOption.color_code) {
      toast.error('Vui lòng nhập mã màu');
      return;
    }

    setOptions([...options, { ...newOption }]);
    setNewOption({ value: '', label: '', color_code: '' });
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const onSubmit = (data: CreateAttributeDefinitionDto) => {
    const formData = {
      ...data,
      options: options.length > 0 ? options : undefined,
    };

    if (isEditing && attribute) {
      updateMutation.mutate({ id: attribute.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Sửa thuộc tính' : 'Thêm thuộc tính mới'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Cập nhật thông tin thuộc tính sản phẩm'
              : 'Tạo thuộc tính mới cho biến thể sản phẩm'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên thuộc tính *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Tên là bắt buộc' })}
                placeholder="Màu sắc"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register('slug', { required: 'Slug là bắt buộc' })}
                placeholder="color"
              />
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Mô tả thuộc tính..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="help_text">Văn bản trợ giúp</Label>
            <Textarea
              id="help_text"
              {...register('help_text')}
              placeholder="Hướng dẫn cho người dùng khi nhập thuộc tính này..."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Hiển thị dưới trường nhập để hướng dẫn người dùng
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon">Biểu tượng (Icon)</Label>
            <Input
              id="icon"
              {...register('icon')}
              placeholder="palette, ruler, package..."
            />
            <p className="text-xs text-muted-foreground">
              Tên icon từ thư viện Lucide React (ví dụ: palette, ruler, package)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="input_type">Loại input</Label>
              <Select
                defaultValue={attribute?.input_type || 'select'}
                onValueChange={(value) => setValue('input_type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">Chọn một</SelectItem>
                  <SelectItem value="multiselect">Chọn nhiều</SelectItem>
                  <SelectItem value="color">Màu sắc</SelectItem>
                  <SelectItem value="text">Văn bản</SelectItem>
                  <SelectItem value="number">Số</SelectItem>
                  <SelectItem value="boolean">Có/Không</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Thứ tự hiển thị</Label>
              <Input
                id="display_order"
                type="number"
                {...register('display_order')}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_variant_attribute"
                defaultChecked={attribute?.is_variant_attribute ?? true}
                onCheckedChange={(checked) =>
                  setValue('is_variant_attribute', checked as boolean)
                }
              />
              <Label htmlFor="is_variant_attribute">Thuộc tính biến thể</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_filterable"
                defaultChecked={attribute?.is_filterable ?? true}
                onCheckedChange={(checked) =>
                  setValue('is_filterable', checked as boolean)
                }
              />
              <Label htmlFor="is_filterable">Có thể lọc</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_required"
                defaultChecked={attribute?.is_required ?? false}
                onCheckedChange={(checked) =>
                  setValue('is_required', checked as boolean)
                }
              />
              <Label htmlFor="is_required">Bắt buộc</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                defaultChecked={attribute?.is_active ?? true}
                onCheckedChange={(checked) =>
                  setValue('is_active', checked as boolean)
                }
              />
              <Label htmlFor="is_active">Hoạt động</Label>
            </div>
          </div>

          {/* Options (for select, multiselect, color types) */}
          {(inputType === 'select' ||
            inputType === 'multiselect' ||
            inputType === 'color') && (
            <div className="space-y-3 border rounded-lg p-4">
              <Label>Giá trị</Label>

              {/* Existing options */}
              {options.length > 0 && (
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded"
                    >
                      {option.color_code && (
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: option.color_code }}
                        />
                      )}
                      <span className="flex-1">
                        {option.label} ({option.value})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new option */}
              <div className="flex gap-2">
                <Input
                  placeholder="Giá trị (value)"
                  value={newOption.value}
                  onChange={(e) =>
                    setNewOption({ ...newOption, value: e.target.value })
                  }
                />
                <Input
                  placeholder="Nhãn (label)"
                  value={newOption.label}
                  onChange={(e) =>
                    setNewOption({ ...newOption, label: e.target.value })
                  }
                />
                {inputType === 'color' && (
                  <Input
                    type="color"
                    value={newOption.color_code}
                    onChange={(e) =>
                      setNewOption({ ...newOption, color_code: e.target.value })
                    }
                    className="w-20"
                  />
                )}
                <Button type="button" onClick={handleAddOption} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Đang lưu...'
                : isEditing
                ? 'Cập nhật'
                : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
