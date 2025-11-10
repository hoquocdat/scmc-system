import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Package, DollarSign, Info, Tag } from 'lucide-react';
import { productsApi } from '@/lib/api/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch product data
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Không tìm thấy sản phẩm</h2>
          <p className="text-muted-foreground mt-2">Sản phẩm này không tồn tại hoặc đã bị xóa.</p>
          <Button onClick={() => navigate('/inventory/products')} className="mt-4">
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (value?: number | string) => {
    if (!value) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(numValue);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/inventory/products')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              SKU: {product.sku}
            </p>
          </div>
          <Button onClick={() => navigate(`/inventory/products/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Chỉnh sửa
          </Button>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2">
          {product.is_active ? (
            <Badge variant="default">Đang hoạt động</Badge>
          ) : (
            <Badge variant="secondary">Không hoạt động</Badge>
          )}
          {product.is_featured && <Badge variant="secondary">Nổi bật</Badge>}
          <Badge variant="outline">{product.product_type || 'physical'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Thông tin cơ bản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tên sản phẩm</label>
                <p className="text-base font-medium">{product.name}</p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Mô tả</label>
                <p className="text-base">{product.description || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Giá bán
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Giá vốn</label>
                  <p className="text-base font-medium">{formatCurrency(product.cost_price)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Giá bán lẻ</label>
                  <p className="text-base font-medium">{formatCurrency(product.retail_price)}</p>
                </div>
              </div>

              {product.sale_price && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Giá khuyến mãi</label>
                    <p className="text-base font-medium text-green-600">{formatCurrency(product.sale_price)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Ngày bắt đầu</label>
                      <p className="text-sm">{formatDate(product.sale_price_start_date)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Ngày kết thúc</label>
                      <p className="text-sm">{formatDate(product.sale_price_end_date)}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Inventory & Dimensions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Kho hàng & Vận chuyển
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Điểm đặt hàng lại</label>
                  <p className="text-base font-medium">{product.reorder_point || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Số lượng đặt hàng</label>
                  <p className="text-base font-medium">{product.reorder_quantity || '-'}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Trọng lượng (kg)</label>
                  <p className="text-sm">{product.weight || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dài (cm)</label>
                  <p className="text-sm">{product.dimensions_length || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Rộng (cm)</label>
                  <p className="text-sm">{product.dimensions_width || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cao (cm)</label>
                  <p className="text-sm">{product.dimensions_height || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Organization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Phân loại
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Danh mục</label>
                <p className="text-base font-medium">
                  {product.product_categories?.name || '-'}
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Thương hiệu</label>
                <p className="text-base font-medium">
                  {product.brands?.name || '-'}
                </p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nhà cung cấp</label>
                <p className="text-base font-medium">
                  {product.suppliers?.name || '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin hệ thống</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ngày tạo</label>
                <p className="text-sm">{formatDate(product.created_at)}</p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cập nhật lần cuối</label>
                <p className="text-sm">{formatDate(product.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
