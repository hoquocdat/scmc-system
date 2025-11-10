import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkFiltersProps {
  statusFilter: string;
  priorityFilter: string;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onClearFilters: () => void;
}

export function WorkFilters({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
  onClearFilters,
}: WorkFiltersProps) {
  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_parts">Waiting Parts</SelectItem>
                <SelectItem value="waiting_approval">Waiting Approval</SelectItem>
                <SelectItem value="quality_check">Quality Check</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Priority</label>
            <Select value={priorityFilter} onValueChange={onPriorityChange}>
              <SelectTrigger>
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-start sm:items-end w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={onClearFilters}
                className="w-full sm:w-auto"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
