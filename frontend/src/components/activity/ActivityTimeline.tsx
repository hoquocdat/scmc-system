import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api-client';
import type { ActivityLog } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

interface ActivityTimelineProps {
  entityType: string;
  entityId: string;
}

interface ActivityWithUser extends ActivityLog {
  user_name?: string;
}

export function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({});

  // Fetch activities using React Query
  const { data: activities = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['activity-logs', entityType, entityId],
    queryFn: async () => {
      const response: any = await apiClient.activityLogs.getByEntity(
        entityType,
        entityId,
        1,
        50
      );

      const activitiesWithUser = response.data?.map((activity: any) => ({
        ...activity,
        user_name: activity.user?.full_name,
      })) || [];

      return activitiesWithUser;
    },
  });

  // Fetch employee names from activities
  useEffect(() => {
    const fetchEmployeeNames = async () => {
      // Extract all unique employee IDs from activities
      const employeeIds = new Set<string>();
      activities.forEach((activity: any) => {
        if (activity.old_values?.assigned_employee_id) {
          employeeIds.add(activity.old_values.assigned_employee_id);
        }
        if (activity.new_values?.assigned_employee_id) {
          employeeIds.add(activity.new_values.assigned_employee_id);
        }
      });

      // Fetch employee names using API client
      if (employeeIds.size > 0) {
        try {
          const employeePromises = Array.from(employeeIds).map(id =>
            apiClient.users.getOne(id).catch(() => null)
          );
          const employeeData = await Promise.all(employeePromises);

          const namesMap: Record<string, string> = {};
          employeeData.forEach((emp: any) => {
            if (emp) {
              namesMap[emp.id] = emp.full_name;
            }
          });
          setEmployeeNames(namesMap);
        } catch (error) {
          console.error('Error fetching employee names:', error);
        }
      }
    };

    if (activities.length > 0) {
      fetchEmployeeNames();
    }
  }, [activities]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `entity_id=eq.${entityId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityId, refetch]);

  const getActionIcon = (action: string): string => {
    const icons: Record<string, string> = {
      created: '✨',
      updated: '✏️',
      status_changed: '🔄',
      task_added: '➕',
      task_completed: '✅',
      part_used: '🔧',
      payment_received: '💰',
      assigned: '👤',
      completed: '🎉',
      cancelled: '❌',
    };
    return icons[action] || '📝';
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      created: 'text-blue-600',
      updated: 'text-amber-600',
      status_changed: 'text-purple-600',
      task_added: 'text-green-600',
      task_completed: 'text-green-700',
      part_used: 'text-indigo-600',
      payment_received: 'text-emerald-600',
      assigned: 'text-blue-600',
      completed: 'text-green-600',
      cancelled: 'text-red-600',
    };
    return colors[action] || 'text-gray-600';
  };

  const formatRelativeTime = (date: string): string => {
    return dayjs(date).fromNow();
  };

  const formatActionText = (action: string): string => {
    const actionLabels: Record<string, string> = {
      created: 'Tạo mới',
      updated: 'Cập nhật',
      status_changed: 'Thay đổi trạng thái',
      task_added: 'Thêm công việc',
      task_completed: 'Hoàn thành công việc',
      part_used: 'Sử dụng phụ tùng',
      payment_received: 'Nhận thanh toán',
      assigned: 'Phân công',
      completed: 'Hoàn thành',
      cancelled: 'Hủy bỏ',
    };
    return actionLabels[action] || action;
  };

  const parseDetails = (details?: string): any => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      status: 'Trạng Thái',
      description: 'Mô Tả',
      customer_demand: 'Yêu Cầu Khách Hàng',
      assigned_employee_id: 'Nhân Viên',
      priority: 'Độ Ưu Tiên',
      estimated_cost: 'Chi Phí Dự Kiến',
      estimated_completion_date: 'Ngày Hoàn Thành Dự Kiến',
      mileage_in: 'Số Km Vào',
    };
    return labels[field] || field;
  };

  const formatFieldValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return 'Không có';

    if (field === 'assigned_employee_id') {
      return employeeNames[value] || 'Không có';
    }

    if (field === 'status') {
      const statusLabels: Record<string, string> = {
        pending: 'Chờ Xử Lý',
        confirmed: 'Đã Xác Nhận',
        in_progress: 'Đang Thực Hiện',
        waiting_parts: 'Chờ Phụ Tùng',
        waiting_approval: 'Chờ Duyệt',
        quality_check: 'Kiểm Tra Chất Lượng',
        completed: 'Hoàn Thành',
        ready_for_pickup: 'Sẵn Sàng Giao',
        delivered: 'Đã Giao',
        cancelled: 'Đã Hủy',
      };
      return statusLabels[value] || value;
    }

    if (field === 'priority') {
      const priorityLabels: Record<string, string> = {
        low: 'Thấp',
        normal: 'Bình Thường',
        high: 'Cao',
        urgent: 'Khẩn Cấp',
      };
      return priorityLabels[value] || value;
    }

    if (field === 'estimated_cost' || field === 'final_cost') {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    }

    if (field.includes('date') && value) {
      return new Date(value).toLocaleDateString('vi-VN');
    }

    return String(value);
  };

  const getChanges = (activity: ActivityWithUser): Array<{ field: string; oldValue: any; newValue: any }> => {
    if (!activity.old_values || !activity.new_values) return [];

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const oldValues = activity.old_values as Record<string, any>;
    const newValues = activity.new_values as Record<string, any>;

    // Fields to track for changes
    const importantFields = [
      'status',
      'description',
      'customer_demand',
      'assigned_employee_id',
      'priority',
      'estimated_cost',
      'estimated_completion_date',
      'mileage_in',
    ];

    importantFields.forEach(field => {
      if (oldValues[field] !== newValues[field]) {
        changes.push({
          field,
          oldValue: oldValues[field],
          newValue: newValues[field],
        });
      }
    });

    return changes;
  };

  if (loading) {
    return <div className="text-center py-6 sm:py-8 text-sm text-muted-foreground">Loading activity...</div>;
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 sm:py-8">
          <p className="text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {activities.map((activity: any, index: number) => {
        const changes = getChanges(activity);

        return (
          <div key={activity.id}>
            <div className="flex gap-3 sm:gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 flex items-center justify-center text-base sm:text-lg ${getActionColor(activity.action)}`}>
                {getActionIcon(activity.action)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    
                    {activity.user_name && (
                      <p className="text-xs text-muted-foreground">
                        bởi {activity.user_name}
                      </p>
                    )}

                    {/* Show changes for updated/status_changed/assigned actions */}
                    {changes.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {changes.map(change => (
                          <div key={change.field} className="text-xs">
                            <p className="text-xs sm:text-sm font-medium">
                      {formatActionText(activity.action)} {getFieldLabel(change.field)}
                    </p>
                            <div className="font-medium text-muted-foreground mb-1">
                              {getFieldLabel(change.field)}:
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-1 bg-red-50 text-red-700 rounded line-through">
                                {formatFieldValue(change.field, change.oldValue)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-1 bg-green-50 text-green-700 rounded font-medium">
                                {formatFieldValue(change.field, change.newValue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Show created action summary */}
                    {activity.action === 'created' && activity.new_values && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Đơn hàng mới được tạo
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatRelativeTime(activity.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {index < activities.length - 1 && (
              <Separator className="my-3 sm:my-4 ml-3 sm:ml-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}
