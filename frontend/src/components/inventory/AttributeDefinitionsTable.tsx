import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Trash2, Tag, Check, X as XIcon, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { attributeDefinitionsApi, type AttributeDefinition } from '@/lib/api/attribute-definitions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      attributeDefinitionsApi.update(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attributeDefinitions'] });
      onRefresh();
    },
    onError: () => {
      toast.error('Có lỗi xảy ra');
    },
  });

  const handleDelete = (attribute: AttributeDefinition) => {
    if (confirm(`Bạn có chắc muốn xóa thuộc tính "${attribute.name}"?`)) {
      deleteMutation.mutate(attribute.id);
    }
  };

  const handleToggleActive = (attribute: AttributeDefinition) => {
    const newState = !attribute.is_active;
    toggleActiveMutation.mutate(
      { id: attribute.id, isActive: newState },
      {
        onSuccess: () => {
          toast.success(
            newState
              ? `Đã kích hoạt "${attribute.name}"`
              : `Đã vô hiệu hóa "${attribute.name}"`
          );
        },
      }
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(data.map((attr) => attr.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkActivate = async () => {
    const promises = Array.from(selectedIds).map((id) =>
      attributeDefinitionsApi.update(id, { is_active: true })
    );

    try {
      await Promise.all(promises);
      toast.success(`Đã kích hoạt ${selectedIds.size} thuộc tính`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['attributeDefinitions'] });
      onRefresh();
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleBulkDeactivate = async () => {
    const promises = Array.from(selectedIds).map((id) =>
      attributeDefinitionsApi.update(id, { is_active: false })
    );

    try {
      await Promise.all(promises);
      toast.success(`Đã vô hiệu hóa ${selectedIds.size} thuộc tính`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['attributeDefinitions'] });
      onRefresh();
    } catch (error) {
      toast.error('Có lỗi xảy ra');
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
    <TooltipProvider>
      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Đã chọn {selectedIds.size} thuộc tính
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkActivate}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Kích hoạt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDeactivate}
              className="gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Vô hiệu hóa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Chọn tất cả"
                />
              </TableHead>
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
                <TableCell colSpan={10} className="text-center py-8">
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
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(attribute.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(attribute.id, checked as boolean)
                      }
                      aria-label={`Chọn ${attribute.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {attribute.name}
                      {attribute.help_text && (
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{attribute.help_text}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
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
                        <DropdownMenuItem onClick={() => handleToggleActive(attribute)}>
                          {attribute.is_active ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Vô hiệu hóa
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Kích hoạt
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
    </TooltipProvider>
  );
}
