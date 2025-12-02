import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { apiClient } from '../lib/api-client';
import type { ServiceStatus, ServiceOrder } from '../types';
import { toast } from 'sonner';
import { BoardHeader } from '../components/service-board/BoardHeader';
import { BoardFilters } from '../components/service-board/BoardFilters';
import { KanbanColumn } from '../components/service-board/KanbanColumn';
import { ServiceOrderCard } from '../components/service-board/ServiceOrderCard';

export function ServiceBoardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);

  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Define all Kanban columns
  const allColumns: { status: ServiceStatus; label: string; color: string }[] = [
    { status: 'pending', label: 'Chờ Xác Nhận', color: 'bg-yellow-100' },
    { status: 'confirmed', label: 'Đã Xác Nhận', color: 'bg-blue-100' },
    { status: 'in_progress', label: 'Đang Xử Lý', color: 'bg-purple-100' },
    { status: 'waiting_parts', label: 'Chờ Phụ Tùng', color: 'bg-orange-100' },
    { status: 'quality_check', label: 'Kiểm Tra', color: 'bg-indigo-100' },
    { status: 'completed', label: 'Hoàn Thành', color: 'bg-green-100' },
    { status: 'ready_for_pickup', label: 'Sẵn Sàng Giao', color: 'bg-teal-100' },
  ];

  // Column visibility state - load from localStorage or default to all visible
  const [visibleColumns, setVisibleColumns] = useState<Set<ServiceStatus>>(() => {
    const saved = localStorage.getItem('kanban-visible-columns');
    if (saved) {
      return new Set(JSON.parse(saved));
    }
    return new Set(allColumns.map(col => col.status));
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch service orders with useQuery
  const { data: serviceOrdersData, isLoading: isLoadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['service-orders', 'kanban'],
    queryFn: async () => {
      const response: any = await apiClient.serviceOrders.getAll(1, 1000);
      return response.data || [];
    },
    refetchInterval: isFullscreen ? 30000 : false, // Auto-refresh every 30s in fullscreen
  });

  // Fetch employees with useQuery
  const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response: any = await apiClient.users.getEmployees();
      return response || [];
    },
  });

  // Mutation for updating service order status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: ServiceStatus }) => {
      return await apiClient.serviceOrders.updateStatus(orderId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders', 'kanban'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể cập nhật trạng thái');
      // Refetch to revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['service-orders', 'kanban'] });
    },
  });

  const serviceOrders = serviceOrdersData || [];
  const employees = employeesData || [];
  const isLoading = isLoadingOrders || isLoadingEmployees;

  // Get only visible columns
  const columns = allColumns.filter(col => visibleColumns.has(col.status));

  // Toggle column visibility
  const toggleColumnVisibility = (status: ServiceStatus) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      // Save to localStorage
      localStorage.setItem('kanban-visible-columns', JSON.stringify([...newSet]));
      return newSet;
    });
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen();
      } catch (err) {
        console.error('Error entering fullscreen:', err);
        toast.error('Không thể vào chế độ toàn màn hình');
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Error exiting fullscreen:', err);
      }
    }
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const order = serviceOrders.find((o: ServiceOrder) => o.id === active.id);
    if (order) {
      setActiveOrder(order);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const orderId = active.id as string;
    const order = serviceOrders.find((o: ServiceOrder) => o.id === orderId);

    if (!order) return;

    // Determine the target status
    let targetStatus: ServiceStatus | null = null;

    // Check if dropped on a column
    if (over.data.current?.type === 'column') {
      targetStatus = over.data.current.status as ServiceStatus;
    } else {
      // Dropped on another card - find its column
      const targetOrder = serviceOrders.find((o: ServiceOrder) => o.id === over.id);
      if (targetOrder) {
        targetStatus = targetOrder.status;
      }
    }

    // If status hasn't changed, do nothing
    if (!targetStatus || order.status === targetStatus) return;

    // Get status label for toast
    const targetColumn = allColumns.find(col => col.status === targetStatus);
    const statusLabel = targetColumn?.label || targetStatus;

    // Optimistically update the UI
    queryClient.setQueryData(['service-orders', 'kanban'], (old: ServiceOrder[] | undefined) => {
      if (!old) return old;
      return old.map(o =>
        o.id === orderId ? { ...o, status: targetStatus } : o
      );
    });

    // Update on server
    updateStatusMutation.mutate(
      { orderId, status: targetStatus },
      {
        onSuccess: () => {
          toast.success(`Đã chuyển sang "${statusLabel}"`);
        },
      }
    );
  };

  const getFilteredOrders = () => {
    return serviceOrders.filter((order: any) => {
      // Filter by employee
      if (selectedEmployee !== 'all' && order.assigned_employee_id !== selectedEmployee) {
        return false;
      }

      // Filter by priority
      if (selectedPriority !== 'all' && order.priority !== selectedPriority) {
        return false;
      }

      // Filter by search query (order number, description, bike, customer, license plate)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const orderData = order as any;
        const matchesOrderNumber = order.order_number.toLowerCase().includes(query);
        const matchesDescription = order.description?.toLowerCase().includes(query);
        const matchesBikeBrand = orderData.motorcycles?.brand?.toLowerCase().includes(query);
        const matchesBikeModel = orderData.motorcycles?.model?.toLowerCase().includes(query);
        const matchesLicensePlate = orderData.motorcycles?.license_plate?.toLowerCase().includes(query);
        const matchesCustomer = orderData.customers?.full_name?.toLowerCase().includes(query);

        if (!matchesOrderNumber && !matchesDescription && !matchesBikeBrand &&
            !matchesBikeModel && !matchesLicensePlate && !matchesCustomer) {
          return false;
        }
      }

      return true;
    });
  };

  const getOrdersByStatus = (status: ServiceStatus) => {
    const filtered = getFilteredOrders();
    return filtered.filter((order: any) => order.status === status);
  };

  const getEmployeeName = (employeeId?: string | null): string => {
    if (!employeeId) return 'Chưa phân công';
    const employee = employees.find((e: any) => e.id === employeeId);
    return employee?.full_name || 'Không xác định';
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="text-center">Đang tải...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full ${isFullscreen ? 'p-4 bg-background' : 'p-4 sm:p-6 md:p-8'}`}>
      {/* Header */}
      <BoardHeader
        isFullscreen={isFullscreen}
        visibleColumns={visibleColumns}
        allColumns={allColumns}
        onRefresh={() => refetchOrders()}
        onToggleFullscreen={toggleFullscreen}
        onToggleColumnVisibility={toggleColumnVisibility}
      />

      {/* Filters */}
      <BoardFilters
        isFullscreen={isFullscreen}
        searchQuery={searchQuery}
        selectedEmployee={selectedEmployee}
        selectedPriority={selectedPriority}
        employees={employees}
        onSearchChange={setSearchQuery}
        onEmployeeChange={setSelectedEmployee}
        onPriorityChange={setSelectedPriority}
      />

      {/* Kanban Board with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`gap-3 sm:gap-4 pb-4 ${isFullscreen ? `grid h-[calc(100vh-220px)]` : 'flex overflow-x-auto'}`} style={isFullscreen ? { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` } : {}}>
          {columns.map(column => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              label={column.label}
              color={column.color}
              orders={getOrdersByStatus(column.status)}
              isFullscreen={isFullscreen}
              employees={employees}
              onOrderClick={(orderId) => navigate(`/service-orders/${orderId}`)}
            />
          ))}
        </div>

        {/* Drag Overlay - shows the card being dragged */}
        <DragOverlay>
          {activeOrder ? (
            <div className="w-72 sm:w-80 opacity-90">
              <ServiceOrderCard
                order={activeOrder}
                isFullscreen={isFullscreen}
                employeeName={getEmployeeName(activeOrder.assigned_employee_id)}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
