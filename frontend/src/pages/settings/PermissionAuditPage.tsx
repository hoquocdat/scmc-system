import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { FileText, Filter, X, Calendar, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { permissionsApi } from '@/lib/api/permissions';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const ACTION_TYPES = [
  { value: 'role_created', label: 'Tạo vai trò' },
  { value: 'role_updated', label: 'Cập nhật vai trò' },
  { value: 'role_deleted', label: 'Xóa vai trò' },
  { value: 'permissions_assigned', label: 'Gán quyền hạn' },
  { value: 'permissions_removed', label: 'Xóa quyền hạn' },
  { value: 'user_roles_assigned', label: 'Gán vai trò cho người dùng' },
  { value: 'user_roles_removed', label: 'Xóa vai trò người dùng' },
];

const RESOURCE_TYPES = [
  { value: 'role', label: 'Vai trò' },
  { value: 'permission', label: 'Quyền hạn' },
  { value: 'user_role', label: 'Vai trò người dùng' },
];

export function PermissionAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Get filters from URL
  const filters = useMemo(
    () => ({
      action: searchParams.get('action') || undefined,
      resourceType: searchParams.get('resourceType') || undefined,
      performedBy: searchParams.get('performedBy') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    }),
    [searchParams],
  );

  // Local filter state
  const [localFilters, setLocalFilters] = useState(filters);

  // Fetch audit logs
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['auditLogs', limit, offset, filters],
    queryFn: () => permissionsApi.getAuditLogs(limit, offset),
  });

  // Filter logs client-side based on filters
  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];

    return auditLogs.filter((log) => {
      if (filters.action && log.action !== filters.action) return false;
      if (filters.resourceType && log.resource_type !== filters.resourceType) return false;
      if (filters.performedBy && log.performed_by !== filters.performedBy) return false;

      if (filters.startDate) {
        const logDate = new Date(log.created_at);
        const startDate = new Date(filters.startDate);
        if (logDate < startDate) return false;
      }

      if (filters.endDate) {
        const logDate = new Date(log.created_at);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (logDate > endDate) return false;
      }

      return true;
    });
  }, [auditLogs, filters]);

  const handleApplyFilters = () => {
    const newParams = new URLSearchParams();
    if (localFilters.action) newParams.set('action', localFilters.action);
    if (localFilters.resourceType) newParams.set('resourceType', localFilters.resourceType);
    if (localFilters.performedBy) newParams.set('performedBy', localFilters.performedBy);
    if (localFilters.startDate) newParams.set('startDate', localFilters.startDate);
    if (localFilters.endDate) newParams.set('endDate', localFilters.endDate);
    setSearchParams(newParams);
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({
      action: undefined,
      resourceType: undefined,
      performedBy: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    setSearchParams(new URLSearchParams());
  };

  const handleRemoveFilter = (key: keyof typeof filters) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    setSearchParams(newParams);
    setLocalFilters((prev) => ({ ...prev, [key]: undefined }));
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created') || action.includes('assigned')) return 'default';
    if (action.includes('deleted') || action.includes('removed')) return 'destructive';
    if (action.includes('updated')) return 'secondary';
    return 'outline';
  };

  const getActionLabel = (action: string) => {
    const actionType = ACTION_TYPES.find((a) => a.value === action);
    return actionType?.label || action;
  };

  const getResourceTypeLabel = (resourceType: string) => {
    const resource = RESOURCE_TYPES.find((r) => r.value === resourceType);
    return resource?.label || resourceType;
  };

  const formatChanges = (changes: Record<string, any>) => {
    if (!changes || Object.keys(changes).length === 0) return 'Không có thay đổi';

    return Object.entries(changes)
      .map(([key, value]) => {
        if (key === 'added' || key === 'removed') {
          const items = Array.isArray(value) ? value : [value];
          return `${key === 'added' ? 'Thêm' : 'Xóa'}: ${items.join(', ')}`;
        }
        if (typeof value === 'object' && value !== null) {
          return `${key}: ${value.from || 'N/A'} → ${value.to || 'N/A'}`;
        }
        return `${key}: ${value}`;
      })
      .join('; ');
  };

  const handlePreviousPage = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  const handleNextPage = () => {
    if (auditLogs && auditLogs.length === limit) {
      setOffset((prev) => prev + limit);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nhật ký quyền hạn</h1>
            <p className="text-muted-foreground">
              Theo dõi tất cả các thay đổi về vai trò và quyền hạn
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số bản ghi</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
            <p className="text-xs text-muted-foreground">Trong {limit} bản ghi gần nhất</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bộ lọc đang áp dụng</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeFilterCount}</div>
            <p className="text-xs text-muted-foreground">Bộ lọc đang hoạt động</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trang hiện tại</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(offset / limit) + 1}</div>
            <p className="text-xs text-muted-foreground">
              Hiển thị {offset + 1}-{offset + filteredLogs.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Lọc
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto sm:max-w-lg">
                <SheetHeader className="px-6">
                  <SheetTitle>Bộ lọc nhật ký</SheetTitle>
                  <SheetDescription>
                    Lọc nhật ký theo hành động, loại tài nguyên, và thời gian
                  </SheetDescription>
                </SheetHeader>

                <div className="px-6 py-6 space-y-4">
                  {/* Action Filter */}
                  <div className="space-y-2">
                    <Label>Hành động</Label>
                    <Select
                      value={localFilters.action}
                      onValueChange={(value) =>
                        setLocalFilters((prev) => ({ ...prev, action: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả hành động" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        {ACTION_TYPES.map((action) => (
                          <SelectItem key={action.value} value={action.value}>
                            {action.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Resource Type Filter */}
                  <div className="space-y-2">
                    <Label>Loại tài nguyên</Label>
                    <Select
                      value={localFilters.resourceType}
                      onValueChange={(value) =>
                        setLocalFilters((prev) => ({ ...prev, resourceType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tất cả loại" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        {RESOURCE_TYPES.map((resource) => (
                          <SelectItem key={resource.value} value={resource.value}>
                            {resource.label}
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
                      value={localFilters.startDate}
                      onChange={(e) =>
                        setLocalFilters((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Đến ngày</Label>
                    <Input
                      type="date"
                      value={localFilters.endDate}
                      onChange={(e) =>
                        setLocalFilters((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    />
                  </div>

                  {/* Performed By */}
                  <div className="space-y-2">
                    <Label>ID người thực hiện</Label>
                    <Input
                      placeholder="Nhập user ID..."
                      value={localFilters.performedBy}
                      onChange={(e) =>
                        setLocalFilters((prev) => ({ ...prev, performedBy: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <SheetFooter className="px-6 pb-6">
                  <Button variant="outline" onClick={handleClearFilters}>
                    Xóa bộ lọc
                  </Button>
                  <Button onClick={handleApplyFilters}>Áp dụng</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Xóa tất cả
              </Button>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={offset === 0}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!auditLogs || auditLogs.length < limit}
            >
              Sau
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filters.action && (
              <Badge variant="secondary" className="gap-1">
                Hành động: {getActionLabel(filters.action)}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter('action')}
                />
              </Badge>
            )}
            {filters.resourceType && (
              <Badge variant="secondary" className="gap-1">
                Loại: {getResourceTypeLabel(filters.resourceType)}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter('resourceType')}
                />
              </Badge>
            )}
            {filters.startDate && (
              <Badge variant="secondary" className="gap-1">
                Từ: {format(new Date(filters.startDate), 'dd/MM/yyyy')}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter('startDate')}
                />
              </Badge>
            )}
            {filters.endDate && (
              <Badge variant="secondary" className="gap-1">
                Đến: {format(new Date(filters.endDate), 'dd/MM/yyyy')}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter('endDate')}
                />
              </Badge>
            )}
            {filters.performedBy && (
              <Badge variant="secondary" className="gap-1">
                User: {filters.performedBy.substring(0, 8)}...
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleRemoveFilter('performedBy')}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Loại tài nguyên</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Người dùng bị ảnh hưởng</TableHead>
                <TableHead>Thay đổi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Không có bản ghi nào</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {getActionLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {getResourceTypeLabel(log.resource_type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {log.user_profiles_permission_audit_log_performed_byTouser_profiles
                              ?.name || 'System'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.user_profiles_permission_audit_log_performed_byTouser_profiles
                              ?.email || log.performed_by}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.user_profiles_permission_audit_log_user_idTouser_profiles ? (
                        <div>
                          <p className="font-medium text-sm">
                            {
                              log.user_profiles_permission_audit_log_user_idTouser_profiles.name
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {
                              log.user_profiles_permission_audit_log_user_idTouser_profiles
                                .email
                            }
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-muted-foreground truncate">
                        {formatChanges(log.changes)}
                      </p>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
