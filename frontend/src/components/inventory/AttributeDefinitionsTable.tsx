import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Trash2, Tag } from 'lucide-react';
import { attributeDefinitionsApi, type AttributeDefinition } from '@/lib/api/attribute-definitions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AttributeDefinitionFormDialog } from './AttributeDefinitionFormDialog';
import { toast } from 'sonner';

interface AttributeDefinitionsTableProps {
  data: AttributeDefinition[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function AttributeDefinitionsTable({
  data,
  isLoading,
  onRefresh,
}: AttributeDefinitionsTableProps) {
  const queryClient = useQueryClient();
  const [editingAttribute, setEditingAttribute] = useState<AttributeDefinition | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => attributeDefinitionsApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa thuộc tính');
      queryClient.invalidateQueries({ queryKey: ['attributeDefinitions'] });
      onRefresh();
    },
    onError: () => {
      toast.error('Có lỗi xảy ra khi xóa thuộc tính');
    },
  });

  const handleDelete = (attribute: AttributeDefinition) => {
    if (confirm(`Bạn có chắc muốn xóa thuộc tính "${attribute.name}"?`)) {
      deleteMutation.mutate(attribute.id);
    }
  };

  const getInputTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      select: 'Chọn một',
      multiselect: 'Chọn nhiều',
      color: 'Màu sắc',
      text: 'Văn bản',
      number: 'Số',
      boolean: 'Có/Không',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Loại input</TableHead>
              <TableHead>Số giá trị</TableHead>
              <TableHead className="text-center">Biến thể</TableHead>
              <TableHead className="text-center">Lọc được</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-center">Thứ tự</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Tag className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Chưa có thuộc tính nào
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((attribute) => (
                <TableRow key={attribute.id}>
                  <TableCell className="font-medium">
                    {attribute.name}
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {attribute.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    {getInputTypeLabel(attribute.input_type)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {attribute.options?.length || 0} giá trị
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {attribute.is_variant_attribute ? (
                      <Badge variant="default">Có</Badge>
                    ) : (
                      <Badge variant="secondary">Không</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {attribute.is_filterable ? (
                      <Badge variant="default">Có</Badge>
                    ) : (
                      <Badge variant="secondary">Không</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {attribute.is_active ? (
                      <Badge variant="default">Hoạt động</Badge>
                    ) : (
                      <Badge variant="destructive">Vô hiệu</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {attribute.display_order}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingAttribute(attribute)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(attribute)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingAttribute && (
        <AttributeDefinitionFormDialog
          open={!!editingAttribute}
          onOpenChange={(open) => !open && setEditingAttribute(null)}
          attribute={editingAttribute}
          onSuccess={() => {
            onRefresh();
            setEditingAttribute(null);
          }}
        />
      )}
    </>
  );
}
