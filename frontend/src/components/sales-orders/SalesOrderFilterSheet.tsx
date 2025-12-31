import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SALES_CHANNEL_LABELS,
} from '@/lib/api/sales';

export interface FilterValues {
  status?: string;
  payment_status?: string;
  channel?: string;
  created_by?: string;
  from_date?: string;
  to_date?: string;
}

interface SalesOrderFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterValues;
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
}

export function SalesOrderFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  onClear,
}: SalesOrderFilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterValues>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, open]);

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalFilters({});
    onClear();
    onOpenChange(false);
  };

  const updateFilter = (key: keyof FilterValues, value: string | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Bộ lọc đơn hàng</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-6 space-y-6">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Trạng thái đơn hàng</Label>
            <Select
              value={localFilters.status || 'all'}
              onValueChange={(value) => updateFilter('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Status Filter */}
          <div className="space-y-2">
            <Label>Trạng thái thanh toán</Label>
            <Select
              value={localFilters.payment_status || 'all'}
              onValueChange={(value) => updateFilter('payment_status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sales Channel Filter */}
          <div className="space-y-2">
            <Label>Kênh bán hàng</Label>
            <Select
              value={localFilters.channel || 'all'}
              onValueChange={(value) => updateFilter('channel', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả kênh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả kênh</SelectItem>
                {Object.entries(SALES_CHANNEL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={localFilters.from_date || ''}
              onChange={(e) => updateFilter('from_date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={localFilters.to_date || ''}
              onChange={(e) => updateFilter('to_date', e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 flex gap-2">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            Xóa bộ lọc
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Áp dụng
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
