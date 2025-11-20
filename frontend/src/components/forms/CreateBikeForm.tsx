import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import type { Brand, Customer } from '@/types';
import { createBikeSchema, type CreateBikeFormData } from '@/lib/validations/bike';

interface CustomerOption {
  value: string;
  label: string;
  phone: string;
  fullName: string;
}

interface BrandOption {
  value: string;
  label: string;
  countryOfOrigin?: string;
}

interface ModelOption {
  value: string;
  label: string;
}

interface CreateBikeFormProps {
  ownerId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateBikeForm({ ownerId, onSuccess, onCancel }: CreateBikeFormProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    watch,
    setValue,
  } = useForm<CreateBikeFormData>({
    resolver: zodResolver(createBikeSchema),
    defaultValues: {
      owner_id: ownerId || '',
      brand: '',
      model: '',
      license_plate: '',
      year: undefined,
      vin: '',
      engine_number: '',
      color: '',
      notes: '',
    },
  });

  // Watch brand changes
  const watchedBrand = watch('brand');

  useEffect(() => {
    fetchBrands();
    // Only fetch customers if ownerId is not provided
    if (!ownerId) {
      fetchCustomers();
    }
  }, [ownerId]);

  // Fetch models when brand changes
  useEffect(() => {
    if (watchedBrand && watchedBrand !== selectedBrand) {
      setSelectedBrand(watchedBrand);
      setValue('model', ''); // Clear model when brand changes
      fetchModels(watchedBrand);
    } else if (!watchedBrand) {
      setModels([]);
      setSelectedBrand('');
    }
  }, [watchedBrand, selectedBrand, setValue]);

  const fetchBrands = async () => {
    try {
      const data: any = await apiClient.brands.getAll();
      setBrands(data || []);
    } catch (err) {
      console.error('Error fetching brands:', err);
      toast.error('Không thể tải danh sách hãng xe');
    }
  };

  const fetchModels = async (brandName: string) => {
    try {
      const data: any = await apiClient.models.getByBrandName(brandName);
      // Extract model names from the response
      const modelNames = (data || []).map((model: any) => model.name);
      setModels(modelNames);
    } catch (err) {
      console.error('Error fetching models:', err);
      // Don't show error toast as this is not critical
      setModels([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response: any = await apiClient.customers.getAll(1, 100);
      setCustomers(response.data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      toast.error('Không thể tải danh sách khách hàng');
    }
  };

  // Convert customers to select options
  const customerOptions: CustomerOption[] = customers.map((customer) => ({
    value: customer.id,
    label: `${customer.full_name} - ${customer.phone}`,
    phone: customer.phone,
    fullName: customer.full_name,
  }));

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

  // Custom filter function for case-insensitive search on name and phone
  const customFilterOption = (option: any, inputValue: string) => {
    const searchValue = inputValue.toLowerCase();
    const fullName = option.data.fullName.toLowerCase();
    const phone = option.data.phone.toLowerCase();
    return fullName.includes(searchValue) || phone.includes(searchValue);
  };

  // Custom format for customer option label
  const formatCustomerOptionLabel = (option: CustomerOption) => (
    <div className="flex flex-col">
      <span className="font-medium">{option.fullName}</span>
      <span className="text-sm text-muted-foreground">{option.phone}</span>
    </div>
  );

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
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Apply formatting: XXXX-XXXXX (4 chars, dash, remaining)
    if (cleaned.length <= 4) {
      return cleaned;
    }

    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 9)}`;
  };

  const onSubmit = async (data: CreateBikeFormData) => {
    try {
      const finalOwnerId = ownerId || data.owner_id;

      if (!finalOwnerId) {
        toast.error('Vui lòng chọn khách hàng');
        return;
      }

      // Convert empty strings to undefined for all optional fields
      const payload = {
        owner_id: finalOwnerId,
        brand: data.brand,
        model: data.model,
        license_plate: data.license_plate,
        year: data.year ? Number(data.year) : undefined,
        vin: data.vin?.trim() || undefined,
        engine_number: data.engine_number?.trim() || undefined,
        color: data.color?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      };

      await apiClient.bikes.create(payload);

      reset();
      toast.success('Tạo xe thành công');
      onSuccess?.();
    } catch (err: any) {
      console.error('Error creating bike:', err);
      toast.error(err.message || 'Không thể tạo xe');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!ownerId && (
        <div className="space-y-2">
          <Label htmlFor="owner_id">Khách Hàng *</Label>
          <Controller
            name="owner_id"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                options={customerOptions}
                value={customerOptions.find((c) => c.value === field.value) || null}
                onChange={(option) => field.onChange(option?.value || '')}
                filterOption={customFilterOption}
                formatOptionLabel={formatCustomerOptionLabel}
                placeholder="Tìm theo tên hoặc số điện thoại..."
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
          {errors.owner_id && (
            <p className="text-sm text-red-600">{errors.owner_id.message}</p>
          )}
          {customers.length === 0 && (
            <p className="text-sm text-amber-600">
              Không tìm thấy khách hàng. Vui lòng tạo khách hàng trước.
            </p>
          )}
        </div>
      )}

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
        {brands.length === 0 && (
          <p className="text-sm text-amber-600">
            Không tìm thấy hãng xe. Vui lòng thêm hãng xe trong hệ thống.
          </p>
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
        {!selectedBrand ? (
          <p className="text-xs text-amber-600">
            ⚠️ Chọn hãng xe để xem danh sách mẫu xe
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Chọn mẫu xe từ danh sách hoặc nhập mẫu mới cho {selectedBrand}
          </p>
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

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo...' : 'Tạo Xe'}
        </Button>
      </div>
    </form>
  );
}
