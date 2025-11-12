import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, type CreateMasterProductDto } from '@/lib/api/products';
import { attributeDefinitionsApi } from '@/lib/api/attribute-definitions';
import { brandsApi } from '@/lib/api/brands';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Check, Package } from 'lucide-react';
import { toast } from 'sonner';

interface MasterProductFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MasterProductForm({ onSuccess, onCancel }: MasterProductFormProps) {
  const queryClient = useQueryClient();
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<CreateMasterProductDto>();

  // Fetch variant attributes
  const { data: attributes } = useQuery({
    queryKey: ['variantAttributes'],
    queryFn: () => attributeDefinitionsApi.getVariantAttributes(),
  });

  // Fetch brands
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.getAll(),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => productCategoriesApi.getAll(),
  });

  // Create master product mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateMasterProductDto) =>
      productsApi.createMasterWithVariants(data),
    onSuccess: (data) => {
      toast.success(`Đã tạo sản phẩm chính và ${data.variantsCreated} biến thể`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo sản phẩm');
    },
  });

  // Calculate variant count
  const variantCount = useMemo(() => {
    const values = Object.values(attributeValues);
    if (values.length === 0) return 0;
    return values.reduce((count, arr) => count * arr.length, 1);
  }, [attributeValues]);

  // Generate variant preview list
  const variantPreview = useMemo(() => {
    if (Object.keys(attributeValues).length === 0) return [];

    const keys = Object.keys(attributeValues);
    const values = Object.values(attributeValues);

    // Generate cartesian product
    const combinations: Record<string, string>[] = values.reduce<Record<string, string>[]>(
      (acc, vals) => {
        if (acc.length === 0) {
          return vals.map((val) => ({ [keys[0]]: val }));
        }
        return acc.flatMap((combo) =>
          vals.map((val) => ({
            ...combo,
            [keys[acc[0] ? Object.keys(acc[0]).length : 0]]: val,
          })),
        );
      },
      [],
    );

    return combinations.slice(0, 10); // Show max 10 for preview
  }, [attributeValues]);

  const handleAttributeToggle = (slug: string, checked: boolean) => {
    if (checked) {
      setSelectedAttributes((prev) => [...prev, slug]);
    } else {
      setSelectedAttributes((prev) => prev.filter((s) => s !== slug));
      setAttributeValues((prev) => {
        const newValues = { ...prev };
        delete newValues[slug];
        return newValues;
      });
    }
  };

  const handleValueToggle = (attrSlug: string, value: string, checked: boolean) => {
    setAttributeValues((prev) => {
      const currentValues = prev[attrSlug] || [];
      if (checked) {
        return { ...prev, [attrSlug]: [...currentValues, value] };
      } else {
        return { ...prev, [attrSlug]: currentValues.filter((v) => v !== value) };
      }
    });
  };

  const onSubmit = (data: any) => {
    if (selectedAttributes.length === 0) {
      toast.error('Vui lòng chọn ít nhất một thuộc tính biến thể');
      return;
    }

    if (Object.values(attributeValues).some((vals) => vals.length === 0)) {
      toast.error('Vui lòng chọn giá trị cho tất cả thuộc tính');
      return;
    }

    const formData: CreateMasterProductDto = {
      ...data,
      retail_price: parseFloat(data.retail_price),
      cost_price: data.cost_price ? parseFloat(data.cost_price) : undefined,
      reorder_point: data.reorder_point ? parseInt(data.reorder_point) : 0,
      reorder_quantity: data.reorder_quantity ? parseInt(data.reorder_quantity) : 0,
      variantAttributes: attributeValues,
    };

    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Product Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              {...register('sku', { required: 'SKU là bắt buộc' })}
              placeholder="PRODUCT-001"
            />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Tên sản phẩm *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Tên sản phẩm là bắt buộc' })}
              placeholder="Áo thun cotton"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Mô tả sản phẩm..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category_id">Danh mục</Label>
            <Select onValueChange={(value) => setValue('category_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn danh mục" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_id">Thương hiệu</Label>
            <Select onValueChange={(value) => setValue('brand_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thương hiệu" />
              </SelectTrigger>
              <SelectContent>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_type">Loại sản phẩm</Label>
            <Select
              defaultValue="physical"
              onValueChange={(value) => setValue('product_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="physical">Hàng hóa vật lý</SelectItem>
                <SelectItem value="service">Dịch vụ</SelectItem>
                <SelectItem value="digital">Sản phẩm số</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="retail_price">Giá bán *</Label>
            <Input
              id="retail_price"
              type="number"
              step="0.01"
              {...register('retail_price', { required: 'Giá bán là bắt buộc' })}
              placeholder="0.00"
            />
            {errors.retail_price && (
              <p className="text-sm text-destructive">{errors.retail_price.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_price">Giá vốn</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              {...register('cost_price')}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Variant Attributes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Thuộc tính biến thể</h3>
        <p className="text-sm text-muted-foreground">
          Chọn các thuộc tính và giá trị để tự động tạo biến thể sản phẩm
        </p>

        {attributes?.map((attr) => (
          <div key={attr.slug} className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`attr-${attr.slug}`}
                checked={selectedAttributes.includes(attr.slug)}
                onCheckedChange={(checked) =>
                  handleAttributeToggle(attr.slug, checked as boolean)
                }
              />
              <Label htmlFor={`attr-${attr.slug}`} className="font-medium">
                {attr.name}
              </Label>
            </div>

            {selectedAttributes.includes(attr.slug) && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Chọn giá trị:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((option) => (
                    <div key={option.value} className="flex items-center">
                      {attr.input_type === 'color' ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleValueToggle(
                              attr.slug,
                              option.value,
                              !attributeValues[attr.slug]?.includes(option.value),
                            )
                          }
                          className={`
                            relative w-10 h-10 rounded-md border-2 transition-all
                            ${
                              attributeValues[attr.slug]?.includes(option.value)
                                ? 'border-primary ring-2 ring-primary'
                                : 'border-gray-300'
                            }
                          `}
                          style={{ backgroundColor: option.color_code }}
                          title={option.label}
                        >
                          {attributeValues[attr.slug]?.includes(option.value) && (
                            <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white drop-shadow-md" />
                          )}
                        </button>
                      ) : (
                        <Badge
                          variant={
                            attributeValues[attr.slug]?.includes(option.value)
                              ? 'default'
                              : 'outline'
                          }
                          className="cursor-pointer"
                          onClick={() =>
                            handleValueToggle(
                              attr.slug,
                              option.value,
                              !attributeValues[attr.slug]?.includes(option.value),
                            )
                          }
                        >
                          {option.label}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Variant Preview */}
      {variantCount > 0 && (
        <Alert>
          <Package className="h-4 w-4" />
          <AlertTitle>Sẽ tạo {variantCount} biến thể</AlertTitle>
          <AlertDescription>
            {variantPreview.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium">Ví dụ:</p>
                <ul className="text-sm space-y-1 ml-4">
                  {variantPreview.map((variant, idx) => (
                    <li key={idx} className="list-disc">
                      {Object.entries(variant)
                        .map(([key, value]) => {
                          const attr = attributes?.find((a) => a.slug === key);
                          const option = attr?.options.find((o) => o.value === value);
                          return option?.label || value;
                        })
                        .join(', ')}
                    </li>
                  ))}
                  {variantCount > 10 && (
                    <li className="list-disc text-muted-foreground">
                      ... và {variantCount - 10} biến thể khác
                    </li>
                  )}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={createMutation.isPending || variantCount === 0}>
          {createMutation.isPending ? 'Đang tạo...' : 'Tạo sản phẩm'}
        </Button>
      </div>
    </form>
  );
}
