import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Loader2, Package, Box, Plus, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { toast } from 'sonner';
import { productsApi, type CreateProductDto } from '@/lib/api/products';
import { brandsApi } from '@/lib/api/brands';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { suppliersApi } from '@/lib/api/suppliers';
import { ImageUploadButton, type UploadFile } from '@/components/common/ImageUploadButton';
import { PhotoGallery } from '@/components/common/PhotoGallery';
import { MasterProductForm } from '@/components/products/MasterProductForm';
import { ProductAttributesEditor } from '@/components/products/ProductAttributesEditor';

// Helper for optional number fields that handles NaN from empty inputs
const optionalNumber = z.number().min(0).optional().or(z.nan().transform(() => undefined));

// Helper for optional date fields that converts empty strings and null to undefined
const optionalDate = z.string().nullable().optional().transform(val => {
  if (!val || val === '') return undefined;
  return val;
});

const productSchema = z.object({
  sku: z.string().min(1, 'SKU là bắt buộc'),
  name: z.string().min(1, 'Tên sản phẩm là bắt buộc'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  brand_id: z.string().optional(),
  supplier_id: z.string().optional(),
  cost_price: z.number("Vui lòng nhập giá vốn").min(0, 'Giá vốn là bắt buộc'),
  retail_price: z.number("Vui lòng nhập giá bán").min(0, 'Giá bán là bắt buộc'),
  sale_price: optionalNumber,
  sale_price_start_date: optionalDate,
  sale_price_end_date: optionalDate,
  reorder_point: optionalNumber,
  reorder_quantity: optionalNumber,
  product_type: z.enum(['physical', 'service', 'digital']).default('physical'),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  weight: optionalNumber,
  dimensions_length: optionalNumber,
  dimensions_width: optionalNumber,
  dimensions_height: optionalNumber,
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  // Image upload state
  const [images, setImages] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);

  // Attributes state for editing
  const [attributes, setAttributes] = useState<Record<string, any>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      is_active: true,
      is_featured: false,
      reorder_point: 10,
      reorder_quantity: 50,
    },
  });

  console.log('errors', errors)

  // Fetch product data if in edit mode
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: isEditMode,
  });

  // Fetch brands, categories, and suppliers for dropdowns
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: brandsApi.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productCategoriesApi.getAll,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getAll,
  });

  // Reset form when switching between create and edit modes
  useEffect(() => {
    if (!isEditMode) {
      // Reset all state for create mode
      setImages([]);
      setUploadingFiles([]);
      setAttributes({});
      reset({
        is_active: true,
        is_featured: false,
        reorder_point: 10,
        reorder_quantity: 50,
        product_type: 'physical',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // Populate form with product data
  useEffect(() => {
    if (product) {
      // Set basic fields
      setValue('sku', product.sku);
      setValue('name', product.name);
      setValue('description', product.description || '');
      setValue('product_type', (product.product_type as 'physical' | 'service' | 'digital') || 'physical');

      // Set price fields
      setValue('cost_price', product.cost_price ? Number(product.cost_price) : undefined as any);
      setValue('retail_price', product.retail_price ? Number(product.retail_price) : 0);
      setValue('sale_price', product.sale_price ? Number(product.sale_price) : undefined as any);
      setValue('sale_price_start_date', product.sale_price_start_date);
      setValue('sale_price_end_date', product.sale_price_end_date);

      // Set inventory fields
      setValue('reorder_point', product.reorder_point ? Number(product.reorder_point) : undefined);
      setValue('reorder_quantity', product.reorder_quantity ? Number(product.reorder_quantity) : undefined);

      // Set dimension fields
      setValue('weight', product.weight ? Number(product.weight) : undefined);
      setValue('dimensions_length', product.dimensions_length ? Number(product.dimensions_length) : undefined);
      setValue('dimensions_width', product.dimensions_width ? Number(product.dimensions_width) : undefined);
      setValue('dimensions_height', product.dimensions_height ? Number(product.dimensions_height) : undefined);

      // Set status fields
      setValue('is_active', product.is_active);
      setValue('is_featured', product.is_featured);

      // Set foreign key IDs (not the nested objects)
      setValue('category_id', product.category_id || undefined);
      setValue('brand_id', product.brand_id || undefined);
      setValue('supplier_id', product.supplier_id || undefined);

      // Load attributes
      if (product.attributes && typeof product.attributes === 'object') {
        setAttributes(product.attributes as Record<string, string>);
      }

      // TODO: Load product images when backend supports it
      // setImages(product.images || []);
    }
  }, [product, setValue]);

  // Handle image upload
  const handleImageUpload = async (files: File[]) => {
    // Create upload file objects with previews
    const newUploadFiles: UploadFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadFiles]);

    // Simulate upload progress (replace with actual upload API later)
    for (let i = 0; i < newUploadFiles.length; i++) {
      const uploadFile = newUploadFiles[i];

      try {
        // Update status to uploading
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.preview === uploadFile.preview
              ? { ...f, status: 'uploading' as const }
              : f
          )
        );

        // Simulate progress (replace with actual upload)
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.preview === uploadFile.preview ? { ...f, progress } : f
            )
          );
        }

        // TODO: Replace with actual API call
        // const uploadedUrl = await uploadImageToServer(uploadFile.file);
        const uploadedUrl = uploadFile.preview; // Temporary: use preview URL

        // Mark as success
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.preview === uploadFile.preview
              ? { ...f, status: 'success' as const, progress: 100 }
              : f
          )
        );

        // Add to images array
        setImages((prev) => [...prev, uploadedUrl]);

        // Remove from uploading after a short delay
        setTimeout(() => {
          setUploadingFiles((prev) =>
            prev.filter((f) => f.preview !== uploadFile.preview)
          );
        }, 1000);
      } catch (error) {
        // Mark as error
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.preview === uploadFile.preview
              ? {
                  ...f,
                  status: 'error' as const,
                  error: 'Tải lên thất bại',
                }
              : f
          )
        );
        toast.error(`Không thể tải lên ${uploadFile.file.name}`);
      }
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.create(data),
    onSuccess: () => {
      toast.success('Đã tạo sản phẩm thành công');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/inventory/products');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể tạo sản phẩm');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.update(id!, data),
    onSuccess: () => {
      toast.success('Đã cập nhật sản phẩm thành công');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      navigate('/inventory/products');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể cập nhật sản phẩm');
    },
  });

  const onSubmit = (data: ProductFormData) => {
    const productData: any = { ...data };

    // Include attributes if they exist
    if (Object.keys(attributes).length > 0) {
      productData.attributes = attributes;
    }

    if (isEditMode) {
      updateMutation.mutate(productData);
    } else {
      createMutation.mutate(productData);
    }
  };


  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditMode && isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/inventory/products')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {isEditMode ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode ? 'Cập nhật thông tin sản phẩm' : 'Thêm sản phẩm mới vào kho'}
              </p>
            </div>
          </div>
          {isEditMode && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/inventory/products')}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                form="edit-product-form"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Cập nhật sản phẩm
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {/* Only show tabs when creating new product */}
      {!isEditMode ? (
        <Tabs defaultValue="simple" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="simple" className="flex items-center gap-2">
              <Box className="h-4 w-4" />
              Sản phẩm đơn giản
            </TabsTrigger>
            <TabsTrigger value="variants" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Sản phẩm có biến thể
            </TabsTrigger>
          </TabsList>

          {/* Simple Product Form */}
          <TabsContent value="simple">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      {...register('sku')}
                      placeholder="VD: PROD-001"
                    />
                    {errors.sku && (
                      <p className="text-sm text-destructive">{errors.sku.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_type">Loại sản phẩm</Label>
                    <Select
                      value={watch('product_type') || 'physical'}
                      onValueChange={(value) => setValue('product_type', value as 'physical' | 'service' | 'digital')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn loại" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Hàng hóa vật lý</SelectItem>
                        <SelectItem value="service">Dịch vụ</SelectItem>
                        <SelectItem value="digital">Sản phẩm số</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Tên sản phẩm *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="VD: Bộ xích nhông"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Mô tả sản phẩm..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Giá bán</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost_price">Giá vốn (VND)</Label>
                    <CurrencyInput
                      id="cost_price"
                      value={watch('cost_price') as number | undefined}
                      onValueChange={(value) => setValue('cost_price', value as any)}
                      placeholder="0"
                    />
                    {errors.cost_price && (
                      <p className="text-sm text-destructive">
                        {errors.cost_price.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retail_price">Giá bán lẻ (VND) *</Label>
                    <CurrencyInput
                      id="retail_price"
                      value={watch('retail_price')}
                      onValueChange={(value) => setValue('retail_price', value || 0)}
                      placeholder="0"
                    />
                    {errors.retail_price && (
                      <p className="text-sm text-destructive">
                        {errors.retail_price.message}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Giá khuyến mãi (Tùy chọn)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sale_price">Giá khuyến mãi (VND)</Label>
                      <CurrencyInput
                        id="sale_price"
                        value={watch('sale_price') as number | undefined}
                        onValueChange={(value) => setValue('sale_price', value as any)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale_price_start_date">Ngày bắt đầu</Label>
                      <Input
                        id="sale_price_start_date"
                        type="date"
                        {...register('sale_price_start_date')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale_price_end_date">Ngày kết thúc</Label>
                      <Input
                        id="sale_price_end_date"
                        type="date"
                        {...register('sale_price_end_date')}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory & Dimensions */}
            <Card>
              <CardHeader>
                <CardTitle>Kho hàng & Vận chuyển</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reorder_point">Điểm đặt hàng lại</Label>
                    <Input
                      id="reorder_point"
                      type="number"
                      {...register('reorder_point', { valueAsNumber: true })}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorder_quantity">Số lượng đặt hàng</Label>
                    <Input
                      id="reorder_quantity"
                      type="number"
                      {...register('reorder_quantity', { valueAsNumber: true })}
                      placeholder="50"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Trọng lượng (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      {...register('weight', { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensions_length">Dài (cm)</Label>
                    <Input
                      id="dimensions_length"
                      type="number"
                      step="0.1"
                      {...register('dimensions_length', { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensions_width">Rộng (cm)</Label>
                    <Input
                      id="dimensions_width"
                      type="number"
                      step="0.1"
                      {...register('dimensions_width', { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensions_height">Cao (cm)</Label>
                    <Input
                      id="dimensions_height"
                      type="number"
                      step="0.1"
                      {...register('dimensions_height', { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Images */}
            <Card>
              <CardHeader>
                <CardTitle>Hình ảnh sản phẩm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Thêm tối đa 10 hình ảnh cho sản phẩm (PNG, JPG, WEBP tối đa 5MB)
                  </p>
                  <ImageUploadButton
                    onUpload={handleImageUpload}
                    maxFiles={10}
                    maxSizeMB={5}
                  />
                </div>

                {(images.length > 0 || uploadingFiles.length > 0) && (
                  <PhotoGallery
                    images={images}
                    uploadingFiles={uploadingFiles}
                    altPrefix="Sản phẩm"
                  />
                )}

                {images.length === 0 && uploadingFiles.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p className="text-sm">Chưa có hình ảnh nào</p>
                    <p className="text-xs mt-1">Nhấp "Add Photos" để thêm hình ảnh</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Trạng thái</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Đang hoạt động</Label>
                  <Switch
                    id="is_active"
                    checked={watch('is_active')}
                    onCheckedChange={(checked) => setValue('is_active', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_featured">Nổi bật</Label>
                  <Switch
                    id="is_featured"
                    checked={watch('is_featured')}
                    onCheckedChange={(checked) => setValue('is_featured', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Organization */}
            <Card>
              <CardHeader>
                <CardTitle>Phân loại</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category_id">Danh mục</Label>
                  <Select
                    value={watch('category_id') || undefined}
                    onValueChange={(value) => setValue('category_id', value === '_none' ? undefined : value)}
                  >
                    <SelectTrigger id="category_id">
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Không chọn --</SelectItem>
                      {categories
                        .filter((cat) => cat.is_active || cat.id === watch('category_id'))
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_id">Thương hiệu</Label>
                  <Select
                    value={watch('brand_id') || undefined}
                    onValueChange={(value) => setValue('brand_id', value === '_none' ? undefined : value)}
                  >
                    <SelectTrigger id="brand_id">
                      <SelectValue placeholder="Chọn thương hiệu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Không chọn --</SelectItem>
                      {brands
                        .filter((brand) => brand.is_active || brand.id === watch('brand_id'))
                        .map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier_id">Nhà cung cấp</Label>
                  <Select
                    value={watch('supplier_id') || undefined}
                    onValueChange={(value) => setValue('supplier_id', value === '_none' ? undefined : value)}
                  >
                    <SelectTrigger id="supplier_id">
                      <SelectValue placeholder="Chọn nhà cung cấp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Không chọn --</SelectItem>
                      {suppliers
                        .filter((supplier) => supplier.is_active || supplier.id === watch('supplier_id'))
                        .map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditMode ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/inventory/products')}
                disabled={isSubmitting}
                className="w-full"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      </form>
          </TabsContent>

          {/* Product with Variants Form */}
          <TabsContent value="variants">
            <MasterProductForm
              onSuccess={() => navigate('/inventory/products')}
              onCancel={() => navigate('/inventory/products')}
            />
          </TabsContent>
        </Tabs>
      ) : (
        // Edit mode - show simple form only
        <form id="edit-product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU *</Label>
                    <Input
                      id="edit-sku"
                      {...register('sku')}
                      placeholder="PRODUCT-001"
                    />
                    {errors.sku && (
                      <p className="text-sm text-destructive">{errors.sku.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Tên sản phẩm *</Label>
                    <Input
                      id="edit-name"
                      {...register('name')}
                      placeholder="Tên sản phẩm"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Mô tả</Label>
                  <Textarea
                    id="edit-description"
                    {...register('description')}
                    placeholder="Mô tả sản phẩm..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing - simplified for edit mode */}
            <Card>
              <CardHeader>
                <CardTitle>Giá cả</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-cost_price">Giá vốn *</Label>
                    <CurrencyInput
                      id="edit-cost_price"
                      value={watch('cost_price')}
                      onValueChange={(value) => setValue('cost_price', value || 0)}
                      placeholder="0"
                    />
                    {errors.cost_price && (
                      <p className="text-sm text-destructive">{errors.cost_price.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-retail_price">Giá bán *</Label>
                    <CurrencyInput
                      id="edit-retail_price"
                      value={watch('retail_price')}
                      onValueChange={(value) => setValue('retail_price', value || 0)}
                      placeholder="0"
                    />
                    {errors.retail_price && (
                      <p className="text-sm text-destructive">{errors.retail_price.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Attributes Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Thuộc tính sản phẩm
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductAttributesEditor
                  value={attributes}
                  onChange={setAttributes}
                  categoryId={watch('category_id')}
                />
              </CardContent>
            </Card>

            {/* Product Images */}
            <Card>
              <CardHeader>
                <CardTitle>Hình ảnh sản phẩm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Thêm tối đa 10 hình ảnh cho sản phẩm
                  </p>
                  <ImageUploadButton
                    onUpload={handleImageUpload}
                    maxFiles={10}
                    maxSizeMB={5}
                  />
                </div>

                {(images.length > 0 || uploadingFiles.length > 0) && (
                  <PhotoGallery
                    images={images}
                    uploadingFiles={uploadingFiles}
                    altPrefix="Sản phẩm"
                  />
                )}

                {images.length === 0 && uploadingFiles.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p className="text-sm">Chưa có hình ảnh nào</p>
                    <p className="text-xs mt-1">Nhấp "Add Photos" để thêm hình ảnh</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Trạng thái</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-is_active">Đang hoạt động</Label>
                  <Switch
                    id="edit-is_active"
                    checked={watch('is_active')}
                    onCheckedChange={(checked) => setValue('is_active', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-is_featured">Nổi bật</Label>
                  <Switch
                    id="edit-is_featured"
                    checked={watch('is_featured')}
                    onCheckedChange={(checked) => setValue('is_featured', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Organization - Category, Brand, Supplier */}
            <Card>
              <CardHeader>
                <CardTitle>Phân loại</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-category_id">Danh mục</Label>
                  <Select
                    value={watch('category_id') || undefined}
                    onValueChange={(value) => setValue('category_id', value === '_none' ? undefined : value)}
                  >
                    <SelectTrigger id="edit-category_id">
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Không chọn --</SelectItem>
                      {categories
                        .filter((cat) => cat.is_active || cat.id === watch('category_id'))
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-brand_id">Thương hiệu</Label>
                  <Select
                    value={watch('brand_id') || undefined}
                    onValueChange={(value) => setValue('brand_id', value === '_none' ? undefined : value)}
                  >
                    <SelectTrigger id="edit-brand_id">
                      <SelectValue placeholder="Chọn thương hiệu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Không chọn --</SelectItem>
                      {brands
                        .filter((brand) => brand.is_active || brand.id === watch('brand_id'))
                        .map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier_id">Nhà cung cấp</Label>
                  <Select
                    value={watch('supplier_id') || undefined}
                    onValueChange={(value) => setValue('supplier_id', value === '_none' ? undefined : value)}
                  >
                    <SelectTrigger id="edit-supplier_id">
                      <SelectValue placeholder="Chọn nhà cung cấp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Không chọn --</SelectItem>
                      {suppliers
                        .filter((supplier) => supplier.is_active || supplier.id === watch('supplier_id'))
                        .map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      )}
      </div>
    </div>
  );
}
