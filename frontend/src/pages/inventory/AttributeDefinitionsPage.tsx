import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, X } from 'lucide-react';
import { attributeDefinitionsApi } from '@/lib/api/attribute-definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AttributeDefinitionsTable } from '@/components/inventory/AttributeDefinitionsTable';
import { AttributeDefinitionFormDialog } from '@/components/inventory/AttributeDefinitionFormDialog';

export function AttributeDefinitionsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inputTypeFilter, setInputTypeFilter] = useState<string>('all');
  const [variantFilter, setVariantFilter] = useState<string>('all');
  const [filterableFilter, setFilterableFilter] = useState<string>('all');

  const { data: attributes, isLoading, refetch } = useQuery({
    queryKey: ['attributeDefinitions'],
    queryFn: () => attributeDefinitionsApi.getAll(true), // Include inactive
  });

  // Filter and search logic
  const filteredAttributes = useMemo(() => {
    if (!attributes) return [];

    return attributes.filter((attr) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        attr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attr.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        attr.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && attr.is_active) ||
        (statusFilter === 'inactive' && !attr.is_active);

      // Input type filter
      const matchesInputType =
        inputTypeFilter === 'all' || attr.input_type === inputTypeFilter;

      // Variant filter
      const matchesVariant =
        variantFilter === 'all' ||
        (variantFilter === 'yes' && attr.is_variant_attribute) ||
        (variantFilter === 'no' && !attr.is_variant_attribute);

      // Filterable filter
      const matchesFilterable =
        filterableFilter === 'all' ||
        (filterableFilter === 'yes' && attr.is_filterable) ||
        (filterableFilter === 'no' && !attr.is_filterable);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesInputType &&
        matchesVariant &&
        matchesFilterable
      );
    });
  }, [attributes, searchQuery, statusFilter, inputTypeFilter, variantFilter, filterableFilter]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (inputTypeFilter !== 'all') count++;
    if (variantFilter !== 'all') count++;
    if (filterableFilter !== 'all') count++;
    return count;
  }, [statusFilter, inputTypeFilter, variantFilter, filterableFilter]);

  const clearAllFilters = () => {
    setStatusFilter('all');
    setInputTypeFilter('all');
    setVariantFilter('all');
    setFilterableFilter('all');
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

      {/* Search and Filter Bar */}
      <div className="mb-4 space-y-4">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, slug hoặc mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Button */}
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(true)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Lọc
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Bộ lọc đang áp dụng:</span>

            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Trạng thái: {statusFilter === 'active' ? 'Hoạt động' : 'Vô hiệu'}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setStatusFilter('all')}
                />
              </Badge>
            )}

            {inputTypeFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Loại: {getInputTypeLabel(inputTypeFilter)}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setInputTypeFilter('all')}
                />
              </Badge>
            )}

            {variantFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Biến thể: {variantFilter === 'yes' ? 'Có' : 'Không'}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setVariantFilter('all')}
                />
              </Badge>
            )}

            {filterableFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Lọc được: {filterableFilter === 'yes' ? 'Có' : 'Không'}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterableFilter('all')}
                />
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 text-xs"
            >
              Xóa tất cả
            </Button>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-3">
          <div className="text-2xl font-bold">{filteredAttributes.length}</div>
          <div className="text-sm text-muted-foreground">Tổng số thuộc tính</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-2xl font-bold">
            {filteredAttributes.filter((a) => a.is_active).length}
          </div>
          <div className="text-sm text-muted-foreground">Đang hoạt động</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-2xl font-bold">
            {filteredAttributes.filter((a) => a.is_variant_attribute).length}
          </div>
          <div className="text-sm text-muted-foreground">Thuộc tính biến thể</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-2xl font-bold">
            {filteredAttributes.filter((a) => a.is_filterable).length}
          </div>
          <div className="text-sm text-muted-foreground">Có thể lọc</div>
        </div>
      </div>

      {/* Table */}
      <AttributeDefinitionsTable
        data={filteredAttributes}
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

      {/* Filter Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader className="px-6">
            <SheetTitle>Bộ lọc thuộc tính</SheetTitle>
            <SheetDescription>
              Lọc danh sách thuộc tính theo các tiêu chí
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-6 space-y-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Vô hiệu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input Type Filter */}
            <div className="space-y-2">
              <Label>Loại input</Label>
              <Select value={inputTypeFilter} onValueChange={setInputTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="select">Chọn một</SelectItem>
                  <SelectItem value="multiselect">Chọn nhiều</SelectItem>
                  <SelectItem value="color">Màu sắc</SelectItem>
                  <SelectItem value="text">Văn bản</SelectItem>
                  <SelectItem value="number">Số</SelectItem>
                  <SelectItem value="boolean">Có/Không</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Variant Attribute Filter */}
            <div className="space-y-2">
              <Label>Thuộc tính biến thể</Label>
              <Select value={variantFilter} onValueChange={setVariantFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="yes">Có</SelectItem>
                  <SelectItem value="no">Không</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filterable Filter */}
            <div className="space-y-2">
              <Label>Có thể lọc</Label>
              <Select value={filterableFilter} onValueChange={setFilterableFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="yes">Có</SelectItem>
                  <SelectItem value="no">Không</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="px-6 pb-6">
            <Button variant="outline" onClick={clearAllFilters}>
              Xóa Bộ Lọc
            </Button>
            <Button onClick={() => setIsFilterOpen(false)}>
              Áp Dụng
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
