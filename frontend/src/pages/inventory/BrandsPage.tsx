import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { brandsApi, type Brand } from '@/lib/api/brands';
import { BrandFormDialog } from '@/components/inventory/BrandFormDialog';
import { BrandsTable } from '@/components/inventory/BrandsTable';
import { toast } from 'sonner';

export function BrandsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | undefined>();
  const queryClient = useQueryClient();

  // Fetch brands
  const { data: brands, isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: brandsApi.getAll,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: brandsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Xóa thương hiệu thành công');
    },
    onError: () => {
      toast.error('Không thể xóa thương hiệu');
    },
  });

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa thương hiệu này?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingBrand(undefined);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Thương hiệu</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý danh sách thương hiệu sản phẩm
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm thương hiệu
          </Button>
        </div>
      </div>

      {/* Brands Table */}
      <BrandsTable
        brands={brands || []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Form Dialog */}
      <BrandFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        brand={editingBrand}
      />
    </div>
  );
}
