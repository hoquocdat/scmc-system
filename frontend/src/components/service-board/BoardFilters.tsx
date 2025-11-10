import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Search } from 'lucide-react';
import type { UserProfile } from '@/types';

interface BoardFiltersProps {
  isFullscreen: boolean;
  searchQuery: string;
  selectedEmployee: string;
  selectedPriority: string;
  employees: UserProfile[];
  onSearchChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
}

export function BoardFilters({
  isFullscreen,
  searchQuery,
  selectedEmployee,
  selectedPriority,
  employees,
  onSearchChange,
  onEmployeeChange,
  onPriorityChange,
}: BoardFiltersProps) {
  return (
    <Card className={`${isFullscreen ? 'mb-3' : 'mb-4 sm:mb-6'}`}>
      <CardContent className={`${isFullscreen ? 'pt-3' : 'pt-4 sm:pt-6'}`}>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo xe, biển số, khách hàng..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Employee Filter */}
          <Select value={selectedEmployee} onValueChange={onEmployeeChange}>
            <SelectTrigger className="w-full sm:w-[180px] md:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Nhân viên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả nhân viên</SelectItem>
              {employees.map(employee => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={selectedPriority} onValueChange={onPriorityChange}>
            <SelectTrigger className="w-full sm:w-[180px] md:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Độ ưu tiên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả mức độ</SelectItem>
              <SelectItem value="low">Thấp</SelectItem>
              <SelectItem value="normal">Bình Thường</SelectItem>
              <SelectItem value="high">Cao</SelectItem>
              <SelectItem value="urgent">Khẩn Cấp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto-refresh indicator in fullscreen */}
        {isFullscreen && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              Auto 30s
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
