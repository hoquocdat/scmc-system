import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Filter, X } from 'lucide-react';
import { productsApi, type ProductQueryParams } from '@/lib/api/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ProductsTable } from '@/components/products/ProductsTable';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { ProductFilters } from '@/components/products/ProductFilters';

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Extract filters from URL
  const filters: ProductQueryParams = {
    search: searchParams.get('search') || undefined,
    category_id: searchParams.get('category_id') || undefined,
    brand_id: searchParams.get('brand_id') || undefined,
    is_active: searchParams.get('is_active') === 'true' ? true : searchParams.get('is_active') === 'false' ? false : undefined,
    is_featured: searchParams.get('is_featured') === 'true',
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
  };

  // Fetch products using TanStack Query
  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productsApi.getAll(filters),
  });

  // Handle search
  const handleSearch = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('search', value);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1'); // Reset to page 1 on search
    setSearchParams(newParams);
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<ProductQueryParams>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
    });
    newParams.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(newParams);
    setIsFilterSheetOpen(false);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchParams({});
  };

  // Remove single filter
  const handleRemoveFilter = (key: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    setSearchParams(newParams);
  };

  // Count active filters (excluding pagination and sort)
  const activeFilterCount = Array.from(searchParams.keys()).filter(
    (key) => !['page', 'limit', 'sort_by', 'sort_order'].includes(key)
  ).length;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sản phẩm</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý danh sách sản phẩm và hàng tồn kho
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm sản phẩm
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo tên, SKU, mô tả..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setIsFilterSheetOpen(true)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Lọc
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-full px-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Bộ lọc đang áp dụng:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Tìm kiếm: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemoveFilter('search')}
              />
            </Badge>
          )}
          {filters.category_id && (
            <Badge variant="secondary" className="gap-1">
              Danh mục
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemoveFilter('category_id')}
              />
            </Badge>
          )}
          {filters.brand_id && (
            <Badge variant="secondary" className="gap-1">
              Thương hiệu
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemoveFilter('brand_id')}
              />
            </Badge>
          )}
          {filters.is_active !== undefined && (
            <Badge variant="secondary" className="gap-1">
              Trạng thái: {filters.is_active ? 'Hoạt động' : 'Không hoạt động'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemoveFilter('is_active')}
              />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7"
          >
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* Products Table */}
      <ProductsTable
        data={productsData?.data || []}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Create Product Dialog */}
      <ProductFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setIsCreateDialogOpen(false);
        }}
      />

      {/* Filter Sheet */}
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader className="px-6">
            <SheetTitle>Lọc sản phẩm</SheetTitle>
            <SheetDescription>
              Chọn các tiêu chí để lọc danh sách sản phẩm
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-6">
            <ProductFilters
              filters={filters}
              onApply={handleFilterChange}
            />
          </div>
          <SheetFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setIsFilterSheetOpen(false)}>
              Đóng
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
