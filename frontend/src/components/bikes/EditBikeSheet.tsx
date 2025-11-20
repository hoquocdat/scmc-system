import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import type { Brand, Motorcycle } from '@/types';
import { z } from 'zod';

const updateBikeSchema = z.object({
  brand: z.string().min(1, 'Vui lòng chọn hãng xe'),
  model: z.string().min(1, 'Vui lòng nhập mẫu xe'),
  license_plate: z.string().min(1, 'Vui lòng nhập biển số'),
  year: z.number().optional().nullable(),
  vin: z.string().optional(),
  engine_number: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type UpdateBikeFormData = z.infer<typeof updateBikeSchema>;

interface BrandOption {
  value: string;
  label: string;
  countryOfOrigin?: string;
}

interface ModelOption {
  value: string;
  label: string;
}

interface EditBikeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bike: Motorcycle;
  onSuccess: () => void;
}

export function EditBikeSheet({ isOpen, onClose, bike, onSuccess }: EditBikeSheetProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>(bike.brand);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue,
    reset,
  } = useForm<UpdateBikeFormData>({
    resolver: zodResolver(updateBikeSchema),
    defaultValues: {
      brand: bike.brand || '',
      model: bike.model || '',
      license_plate: bike.license_plate || '',
      year: bike.year || undefined,
      vin: bike.vin || '',
      engine_number: bike.engine_number || '',
      color: bike.color || '',
      notes: bike.notes || '',
    },
  });

  // Watch brand changes
  const watchedBrand = watch('brand');

  // Fetch brands using useQuery
  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const data: any = await apiClient.brands.getAll();
      return data || [];
    },
  });

  const brands: Brand[] = brandsData || [];

  // Fetch models using useQuery when brand is selected
  const { data: modelsData } = useQuery({
    queryKey: ['models', selectedBrand],
    queryFn: async () => {
      if (!selectedBrand) return [];
      const data: any = await apiClient.models.getByBrandName(selectedBrand);
      return (data || []).map((model: any) => model.name);
    },
    enabled: !!selectedBrand,
  });

  const models: string[] = modelsData || [];

  // Update bike mutation
  const updateBikeMutation = useMutation({
    mutationFn: async (data: UpdateBikeFormData) => {
      // Convert empty strings to undefined for all optional fields
      const payload = {
        brand: data.brand,
        model: data.model,
        license_plate: data.license_plate,
        year: data.year ? Number(data.year) : undefined,
        vin: data.vin?.trim() || undefined,
        engine_number: data.engine_number?.trim() || undefined,
        color: data.color?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      };
      return await apiClient.bikes.update(bike.id, payload);
    },
    onSuccess: () => {
      toast.success('Cập nhật xe thành công');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      console.error('Error updating bike:', error);
      toast.error(error.message || 'Không thể cập nhật xe');
    },
  });

  // Fetch models when brand changes
  useEffect(() => {
    if (watchedBrand && watchedBrand !== selectedBrand) {
      setSelectedBrand(watchedBrand);
      setValue('model', ''); // Clear model when brand changes
    } else if (!watchedBrand) {
      setSelectedBrand('');
    }
  }, [watchedBrand, selectedBrand, setValue]);

  // Reset form when bike changes or sheet opens
  useEffect(() => {
    if (isOpen) {
      reset({
        brand: bike.brand || '',
        model: bike.model || '',
        license_plate: bike.license_plate || '',
        year: bike.year || undefined,
        vin: bike.vin || '',
        engine_number: bike.engine_number || '',
        color: bike.color || '',
        notes: bike.notes || '',
      });
      setSelectedBrand(bike.brand || '');
    }
  }, [isOpen, bike, reset]);

  // Convert brands to select options
  const brandOptions: BrandOption[] = brands.map((brand) => ({
    value: brand.name,
    label: brand.name,
    countryOfOrigin: brand.country_of_origin,
  }));

  // Convert models to select options
  const modelOptions: ModelOption[] = models.map((model) => ({
    value: model,
    label: model,
  }));

  // Custom format for brand option label
  const formatBrandOptionLabel = (option: BrandOption) => (
    <div className="flex items-center justify-between">
      <span className="font-medium">{option.label}</span>
      {option.countryOfOrigin && (
        <span className="text-xs text-muted-foreground ml-2">
          {option.countryOfOrigin}
        </span>
      )}
    </div>
  );

  // Format license plate: 59A3-12345 or 59A312345
  const formatLicensePlate = (value: string): string => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length <= 4) {
      return cleaned;
    }
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 9)}`;
  };

  const onSubmit = (data: UpdateBikeFormData) => {
    updateBikeMutation.mutate(data);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader className="px-6">
          <SheetTitle>Sửa Thông Tin Xe</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand">Hãng Xe *</Label>
            <Controller
              name="brand"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={brandOptions}
                  value={brandOptions.find((b) => b.value === field.value) || null}
                  onChange={(option) => field.onChange(option?.value || '')}
                  formatOptionLabel={formatBrandOptionLabel}
                  placeholder="Tìm hãng xe..."
                  isClearable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '36px',
                      borderColor: 'hsl(var(--input))',
                      '&:hover': {
                        borderColor: 'hsl(var(--input))',
                      },
                    }),
                  }}
                />
              )}
            />
            {errors.brand && (
              <p className="text-sm text-red-600">{errors.brand.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Mẫu Xe *</Label>
            <Controller
              name="model"
              control={control}
              render={({ field }) => (
                <CreatableSelect
                  {...field}
                  options={modelOptions}
                  value={modelOptions.find((m) => m.value === field.value) || (field.value ? { value: field.value, label: field.value } : null)}
                  onChange={(option) => field.onChange(option?.value || '')}
                  onCreateOption={(inputValue) => {
                    field.onChange(inputValue);
                  }}
                  placeholder={selectedBrand ? "Chọn hoặc nhập mẫu xe..." : "Vui lòng chọn hãng xe trước"}
                  isDisabled={!selectedBrand}
                  isClearable
                  formatCreateLabel={(inputValue) => `Tạo mới: "${inputValue}"`}
                  noOptionsMessage={() => "Không có mẫu xe nào. Bạn có thể nhập mẫu mới."}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '36px',
                      borderColor: 'hsl(var(--input))',
                      '&:hover': {
                        borderColor: 'hsl(var(--input))',
                      },
                    }),
                  }}
                />
              )}
            />
            {errors.model && (
              <p className="text-sm text-red-600">{errors.model.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_plate">Biển Số Xe *</Label>
            <Controller
              name="license_plate"
              control={control}
              render={({ field }) => (
                <Input
                  id="license_plate"
                  value={field.value}
                  onChange={(e) => {
                    const formatted = formatLicensePlate(e.target.value);
                    field.onChange(formatted);
                  }}
                  placeholder="Ví dụ: 59A3-12345"
                  className="font-mono uppercase"
                  maxLength={10}
                />
              )}
            />
            {errors.license_plate && (
              <p className="text-sm text-red-600">{errors.license_plate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Năm Sản Xuất</Label>
            <Input
              id="year"
              type="number"
              {...register('year', { valueAsNumber: true })}
              placeholder="Ví dụ: 2020"
            />
            {errors.year && (
              <p className="text-sm text-red-600">{errors.year.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Màu Xe</Label>
            <Input
              id="color"
              {...register('color')}
              placeholder="Ví dụ: Đỏ, Đen, Trắng"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vin">Số Khung (VIN)</Label>
            <Input
              id="vin"
              {...register('vin')}
              placeholder="Số khung xe"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="engine_number">Số Máy</Label>
            <Input
              id="engine_number"
              {...register('engine_number')}
              placeholder="Số máy xe"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bike_notes">Ghi Chú</Label>
            <Textarea
              id="bike_notes"
              {...register('notes')}
              className="min-h-[60px]"
              placeholder="Ghi chú về xe"
            />
          </div>
        </form>

        <SheetFooter className="px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updateBikeMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={updateBikeMutation.isPending}
          >
            {updateBikeMutation.isPending ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
