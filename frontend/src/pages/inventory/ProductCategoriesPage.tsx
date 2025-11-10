import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { productCategoriesApi, type ProductCategory } from '@/lib/api/product-categories';
import { ProductCategoriesTable } from '@/components/inventory/ProductCategoriesTable';
import { ProductCategoryFormDialog } from '@/components/inventory/ProductCategoryFormDialog';
import { toast } from 'sonner';

export function ProductCategoriesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | undefined>();
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productCategoriesApi.getAll,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: productCategoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Xóa danh mục thành công');
    },
    onError: () => {
      toast.error('Không thể xóa danh mục');
    },
  });

  const handleEdit = (category: ProductCategory) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa danh mục này?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCategory(undefined);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Danh mục sản phẩm</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý danh mục và phân loại sản phẩm
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm danh mục
          </Button>
        </div>
      </div>

      {/* Categories Table */}
      <ProductCategoriesTable
        categories={categories || []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Form Dialog */}
      <ProductCategoryFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        category={editingCategory}
        categories={categories || []}
      />
    </div>
  );
}
