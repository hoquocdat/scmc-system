import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { attributeDefinitionsApi } from '@/lib/api/attribute-definitions';
import { Button } from '@/components/ui/button';
import { AttributeDefinitionsTable } from '@/components/inventory/AttributeDefinitionsTable';
import { AttributeDefinitionFormDialog } from '@/components/inventory/AttributeDefinitionFormDialog';

export function AttributeDefinitionsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: attributes, isLoading, refetch } = useQuery({
    queryKey: ['attributeDefinitions'],
    queryFn: () => attributeDefinitionsApi.getAll(true), // Include inactive
  });

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Thuộc tính sản phẩm
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Quản lý các thuộc tính cho biến thể sản phẩm
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm thuộc tính
          </Button>
        </div>
      </div>

      {/* Table */}
      <AttributeDefinitionsTable
        data={attributes || []}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Create Dialog */}
      <AttributeDefinitionFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setIsCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
