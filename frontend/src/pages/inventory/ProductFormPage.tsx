import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2, Package, Box, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { productsApi, type CreateProductDto } from '@/lib/api/products';
import { brandsApi } from '@/lib/api/brands';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { suppliersApi } from '@/lib/api/suppliers';
import { type UploadFile } from '@/components/common/ImageUploadButton';
import { MasterProductForm } from '@/components/products/MasterProductForm';
import { ProductAttributesEditor } from '@/components/products/ProductAttributesEditor';
import {
  ProductBasicInfoCard,
  ProductPricingCard,
  ProductInventoryCard,
  ProductImagesCard,
  ProductStatusCard,
  ProductOrganizationCard,
  productSchema,
  type ProductFormData,
} from '@/components/products/form';

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
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      is_active: true,
      is_featured: false,
      reorder_point: 10,
      reorder_quantity: 50,
      product_type: 'physical',
    },
  });

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
      setValue('sku', product.sku);
      setValue('name', product.name);
      setValue('description', product.description || '');
      setValue('product_type', (product.product_type as 'physical' | 'service' | 'digital') || 'physical');
      setValue('cost_price', product.cost_price ? Number(product.cost_price) : 0);
      setValue('retail_price', product.retail_price ? Number(product.retail_price) : 0);
      setValue('sale_price', product.sale_price ? Number(product.sale_price) : undefined);
      setValue('sale_price_start_date', product.sale_price_start_date);
      setValue('sale_price_end_date', product.sale_price_end_date);
      setValue('reorder_point', product.reorder_point ? Number(product.reorder_point) : undefined);
      setValue('reorder_quantity', product.reorder_quantity ? Number(product.reorder_quantity) : undefined);
      setValue('weight', product.weight ? Number(product.weight) : undefined);
      setValue('dimensions_length', product.dimensions_length ? Number(product.dimensions_length) : undefined);
      setValue('dimensions_width', product.dimensions_width ? Number(product.dimensions_width) : undefined);
      setValue('dimensions_height', product.dimensions_height ? Number(product.dimensions_height) : undefined);
      setValue('is_active', product.is_active);
      setValue('is_featured', product.is_featured);
      setValue('category_id', product.category_id || undefined);
      setValue('brand_id', product.brand_id || undefined);
      setValue('supplier_id', product.supplier_id || undefined);

      if (product.attributes && typeof product.attributes === 'object') {
        setAttributes(product.attributes as Record<string, string>);
      }
    }
  }, [product, setValue]);

  // Handle image upload
  const handleImageUpload = async (files: File[]) => {
    const newUploadFiles: UploadFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadFiles]);

    for (const uploadFile of newUploadFiles) {
      try {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.preview === uploadFile.preview ? { ...f, status: 'uploading' as const } : f
          )
        );

        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          setUploadingFiles((prev) =>
            prev.map((f) => (f.preview === uploadFile.preview ? { ...f, progress } : f))
          );
        }

        const uploadedUrl = uploadFile.preview;

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.preview === uploadFile.preview ? { ...f, status: 'success' as const, progress: 100 } : f
          )
        );

        setImages((prev) => [...prev, uploadedUrl]);

        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((f) => f.preview !== uploadFile.preview));
        }, 1000);
      } catch {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.preview === uploadFile.preview
              ? { ...f, status: 'error' as const, error: 'Tải lên thất bại' }
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

  const formProps = { register, errors, watch, setValue };

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
                    <ProductBasicInfoCard {...formProps} />
                    <ProductPricingCard {...formProps} showSalePrice={true} />
                    <ProductInventoryCard {...formProps} />
                    <ProductImagesCard
                      images={images}
                      uploadingFiles={uploadingFiles}
                      onUpload={handleImageUpload}
                    />
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    <ProductStatusCard watch={watch} setValue={setValue} />
                    <ProductOrganizationCard
                      watch={watch}
                      setValue={setValue}
                      categories={categories}
                      brands={brands}
                      suppliers={suppliers}
                    />

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
                            Tạo sản phẩm
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
                <ProductBasicInfoCard {...formProps} idPrefix="edit" />
                <ProductPricingCard {...formProps} idPrefix="edit" showSalePrice={false} />

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

                <ProductImagesCard
                  images={images}
                  uploadingFiles={uploadingFiles}
                  onUpload={handleImageUpload}
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <ProductStatusCard watch={watch} setValue={setValue} idPrefix="edit" />
                <ProductOrganizationCard
                  watch={watch}
                  setValue={setValue}
                  categories={categories}
                  brands={brands}
                  suppliers={suppliers}
                  idPrefix="edit"
                />
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
