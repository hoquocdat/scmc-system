import { useState, useEffect } from 'react';
import { Search, Plus, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { StatusMultiSelect, STATUS_LABELS } from '@/components/forms/StatusSelect';
import { PriorityMultiSelect, PRIORITY_LABELS } from '@/components/forms/PrioritySelect';
import { EmployeeMultiSelect } from '@/components/forms/EmployeeSelect';
import type { UserProfile } from '@/types';

interface ServiceOrderToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string[];
  priorityFilter: string[];
  employeeFilter: string[];
  employees: UserProfile[];
  onCreateOrder: () => void;
  isFilterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  onApplyFilters: (status: string[], priority: string[], employee: string[]) => void;
}

export function ServiceOrderToolbar({
  searchQuery,
  onSearchChange,
  statusFilter: appliedStatusFilter,
  priorityFilter: appliedPriorityFilter,
  employeeFilter: appliedEmployeeFilter,
  employees,
  onCreateOrder,
  isFilterOpen,
  onFilterOpenChange,
  onApplyFilters,
}: ServiceOrderToolbarProps) {
  // Internal state for draft filters (before "Áp Dụng" is clicked)
  const [draftStatusFilter, setDraftStatusFilter] = useState<string[]>(appliedStatusFilter);
  const [draftPriorityFilter, setDraftPriorityFilter] = useState<string[]>(appliedPriorityFilter);
  const [draftEmployeeFilter, setDraftEmployeeFilter] = useState<string[]>(appliedEmployeeFilter);

  // Sync draft filters with applied filters when they change externally (e.g., from URL)
  useEffect(() => {
    setDraftStatusFilter(appliedStatusFilter);
    setDraftPriorityFilter(appliedPriorityFilter);
    setDraftEmployeeFilter(appliedEmployeeFilter);
  }, [appliedStatusFilter, appliedPriorityFilter, appliedEmployeeFilter]);

  const activeFiltersCount = appliedStatusFilter.length + appliedPriorityFilter.length + appliedEmployeeFilter.length;

  const handleClearFilters = () => {
    setDraftStatusFilter([]);
    setDraftPriorityFilter([]);
    setDraftEmployeeFilter([]);
  };

  const handleApplyFilters = () => {
    onApplyFilters(draftStatusFilter, draftPriorityFilter, draftEmployeeFilter);
    onFilterOpenChange(false);
  };

  const removeStatusFilter = (value: string) => {
    const newFilters = appliedStatusFilter.filter((v) => v !== value);
    onApplyFilters(newFilters, appliedPriorityFilter, appliedEmployeeFilter);
  };

  const removePriorityFilter = (value: string) => {
    const newFilters = appliedPriorityFilter.filter((v) => v !== value);
    onApplyFilters(appliedStatusFilter, newFilters, appliedEmployeeFilter);
  };

  const removeEmployeeFilter = (value: string) => {
    const newFilters = appliedEmployeeFilter.filter((v) => v !== value);
    onApplyFilters(appliedStatusFilter, appliedPriorityFilter, newFilters);
  };

  return (
    <div className="flex flex-col gap-4 mb-4">
      {/* Top row: Search, Filter and Create button */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo số đơn, biển số, khách hàng..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => onFilterOpenChange(true)}
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Lọc
            {activeFiltersCount > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center" variant="default">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          <Button onClick={onCreateOrder} size="default">
            <Plus className="h-4 w-4 mr-2" />
            Tạo Đơn
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Đang lọc ({activeFiltersCount}):</span>

          {appliedStatusFilter.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {STATUS_LABELS[status]}
              <button
                onClick={() => removeStatusFilter(status)}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {appliedPriorityFilter.map((priority) => (
            <Badge key={priority} variant="secondary" className="gap-1">
              {PRIORITY_LABELS[priority]}
              <button
                onClick={() => removePriorityFilter(priority)}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {appliedEmployeeFilter.map((empId) => (
            <Badge key={empId} variant="secondary" className="gap-1">
              {empId === 'unassigned'
                ? 'Chưa phân công'
                : employees.find((e) => e.id === empId)?.full_name}
              <button
                onClick={() => removeEmployeeFilter(empId)}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 text-xs"
          >
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* Filter Sheet */}
      <Sheet open={isFilterOpen} onOpenChange={onFilterOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader className="px-6">
            <SheetTitle>Bộ Lọc</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 px-6 py-6">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Trạng Thái</Label>
              <StatusMultiSelect
                value={draftStatusFilter}
                onChange={setDraftStatusFilter}
              />
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Độ Ưu Tiên</Label>
              <PriorityMultiSelect
                value={draftPriorityFilter}
                onChange={setDraftPriorityFilter}
              />
            </div>

            {/* Employee Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nhân Viên</Label>
              <EmployeeMultiSelect
                value={draftEmployeeFilter}
                onChange={setDraftEmployeeFilter}
                employees={employees}
              />
            </div>
          </div>

          <SheetFooter className="flex flex-row gap-2 px-6 pb-6">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1"
            >
              Xóa Bộ Lọc
            </Button>
            <Button
              onClick={handleApplyFilters}
              className="flex-1"
            >
              Áp Dụng
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
