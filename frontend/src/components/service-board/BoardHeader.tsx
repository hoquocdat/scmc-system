import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RefreshCw, Maximize, Minimize, Settings } from 'lucide-react';
import type { ServiceStatus } from '@/types';

interface BoardHeaderProps {
  isFullscreen: boolean;
  visibleColumns: Set<ServiceStatus>;
  allColumns: { status: ServiceStatus; label: string; color: string }[];
  onRefresh: () => void;
  onToggleFullscreen: () => void;
  onToggleColumnVisibility: (status: ServiceStatus) => void;
}

export function BoardHeader({
  isFullscreen,
  visibleColumns,
  allColumns,
  onRefresh,
  onToggleFullscreen,
  onToggleColumnVisibility,
}: BoardHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 ${isFullscreen ? 'mb-3' : 'mb-4 sm:mb-6'}`}>
      <div className="min-w-0 flex-1">
        <h1 className={`font-bold tracking-tight ${isFullscreen ? 'text-lg' : 'text-xl sm:text-2xl'}`}>
          Bảng Theo Dõi Service
        </h1>
        {!isFullscreen && (
          <p className="text-sm sm:text-base text-muted-foreground">
            Theo dõi trạng thái của tất cả các xe đang được bảo dưỡng
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <Button
          variant="outline"
          size={isFullscreen ? 'sm' : 'sm'}
          onClick={onRefresh}
          className="sm:size-default"
        >
          <RefreshCw className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Làm mới</span>
        </Button>

        {/* Column Visibility Control */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size={isFullscreen ? 'sm' : 'sm'} className="sm:size-default">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cột hiển thị</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <div className="font-medium text-sm">Hiển thị/Ẩn cột</div>
              <div className="space-y-2">
                {allColumns.map(column => (
                  <div key={column.status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${column.status}`}
                      checked={visibleColumns.has(column.status)}
                      onCheckedChange={() => onToggleColumnVisibility(column.status)}
                    />
                    <label
                      htmlFor={`col-${column.status}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {column.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size={isFullscreen ? 'sm' : 'sm'}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          className="sm:size-default"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
