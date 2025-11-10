import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { StorageService } from '../storage/storage.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
    employees?: string[],
    status?: string[],
    priority?: string[],
    search?: string,
  ) {
    const offset = (page - 1) * limit;

    // Build where clause dynamically
    const where: any = {};

    console.log('Filter params:', { employees, status, priority, search });

    if (employees && employees.length > 0) {
      // Check if "unassigned" is in the filter
      const hasUnassigned = employees.includes('unassigned');
      const employeeIds = employees.filter(id => id !== 'unassigned');

      if (hasUnassigned && employeeIds.length > 0) {
        // Both unassigned and specific employees
        where.OR = [
          { assigned_employee_id: null },
          { assigned_employee_id: { in: employeeIds } },
        ];
      } else if (hasUnassigned) {
        // Only unassigned
        where.assigned_employee_id = null;
      } else if (employeeIds.length > 0) {
        // Only specific employees
        where.assigned_employee_id = { in: employeeIds };
      }
    }

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    if (priority && priority.length > 0) {
      where.priority = { in: priority };
    }

    if (search) {
      // If we already have OR from employee filter, we need to combine them
      const searchConditions = [
        { order_number: { contains: search, mode: 'insensitive' } },
        { bikes: { license_plate: { contains: search, mode: 'insensitive' } } },
        { customers: { full_name: { contains: search, mode: 'insensitive' } } },
      ];

      if (where.OR) {
        // Combine employee OR with search OR using AND
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    console.log('Prisma where clause:', JSON.stringify(where, null, 2));

    const [data, count] = await Promise.all([
      this.prisma.service_orders.findMany({
        where,
        include: {
          bikes: true,
          customers: true,
          user_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.service_orders.count({ where }),
    ]);

    console.log('Results count:', data.length, 'Unique employees:', [...new Set(data.map(o => o.assigned_employee_id))]);

    // Map 'bikes' to 'motorcycles' for frontend compatibility
    const mappedData = data.map((order) => ({
      ...order,
      motorcycles: order.bikes,
    }));

    return {
      data: mappedData,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findOne(id: string) {
    const serviceOrder = await this.prisma.service_orders.findUnique({
      where: { id },
    });

    if (!serviceOrder) {
      throw new NotFoundException(`Service order with ID ${id} not found`);
    }

    return serviceOrder;
  }

  async getEmployees(serviceOrderId: string) {
    const employees = await this.prisma.service_order_employees.findMany({
      where: { service_order_id: serviceOrderId },
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: {
        is_primary: 'desc',
      },
    });

    return employees;
  }

  async findByEmployee(technicianId: string) {
    return this.prisma.service_orders.findMany({
      where: {
        assigned_employee_id: technicianId,
        status: {
          notIn: ['delivered', 'cancelled'],
        },
      },
      orderBy: {
        priority: 'desc',
      },
    });
  }

  async create(createServiceOrderDto: CreateServiceOrderDto, userId?: string) {
    // Generate order number (format: SO-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of orders today to generate sequence number
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayCount = await this.prisma.service_orders.count({
      where: {
        created_at: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const sequenceNumber = String(todayCount + 1).padStart(4, '0');
    const orderNumber = `SO-${dateStr}-${sequenceNumber}`;

    const serviceOrder = await this.prisma.service_orders.create({
      data: {
        order_number: orderNumber,
        motorcycle_id: createServiceOrderDto.motorcycle_id,
        customer_id: createServiceOrderDto.customer_id,
        assigned_employee_id: createServiceOrderDto.assigned_employee_id || null,
        status: 'pending',
        priority: createServiceOrderDto.priority as any,
        description: createServiceOrderDto.description || null,
        customer_demand: createServiceOrderDto.customer_demand || null,
        mileage_in: createServiceOrderDto.mileage_in || null,
        estimated_completion_date: createServiceOrderDto.estimated_completion_date || null,
        estimated_cost: createServiceOrderDto.estimated_cost || null,
        drop_off_date: new Date(),
        pickup_id_verified: false,
      },
    });

    // Handle multiple technicians if provided
    if (createServiceOrderDto.employee_ids && createServiceOrderDto.employee_ids.length > 0) {
      const technicianAssignments = createServiceOrderDto.employee_ids.map((techId, index) => ({
        service_order_id: serviceOrder.id,
        employee_id: techId,
        is_primary: index === 0, // First technician is primary
      }));

      try {
        await this.prisma.service_order_employees.createMany({
          data: technicianAssignments,
        });
      } catch (error) {
        console.error('Error assigning technicians:', error);
        // Don't fail the entire operation, just log the error
      }
    }

    // Log activity
    await this.activityLogsService.logActivity({
      userId,
      entityType: 'service_order',
      entityId: serviceOrder.id,
      action: 'created',
      newValues: serviceOrder,
    });

    return serviceOrder;
  }

  async update(id: string, updateServiceOrderDto: UpdateServiceOrderDto, userId?: string) {
    const oldData = await this.findOne(id);

    const serviceOrder = await this.prisma.service_orders.update({
      where: { id },
      data: {
        ...updateServiceOrderDto,
        updated_at: new Date(),
      },
    });

    // Log activity with old and new values
    await this.activityLogsService.logActivity({
      userId,
      entityType: 'service_order',
      entityId: id,
      action: 'updated',
      oldValues: oldData,
      newValues: serviceOrder,
    });

    return serviceOrder;
  }

  async updateStatus(id: string, updateStatusDto: UpdateStatusDto, userId?: string) {
    const oldData = await this.findOne(id);

    const updateData: any = {
      status: updateStatusDto.status,
      updated_at: new Date(),
    };

    // Set completion date when status changes to completed
    if (updateStatusDto.status === 'completed') {
      updateData.actual_completion_date = new Date();
    }

    const serviceOrder = await this.prisma.service_orders.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await this.activityLogsService.logActivity({
      userId,
      entityType: 'service_order',
      entityId: id,
      action: 'status_changed',
      oldValues: { status: oldData.status },
      newValues: { status: serviceOrder.status },
    });

    return serviceOrder;
  }

  async assignEmployee(id: string, assignEmployeeDto: AssignEmployeeDto, userId?: string) {
    const oldData = await this.findOne(id);

    const serviceOrder = await this.prisma.service_orders.update({
      where: { id },
      data: {
        assigned_employee_id: assignEmployeeDto.employee_id,
        updated_at: new Date(),
      },
    });

    // Log activity
    await this.activityLogsService.logActivity({
      userId,
      entityType: 'service_order',
      entityId: id,
      action: 'assigned',
      oldValues: { assigned_employee_id: oldData.assigned_employee_id },
      newValues: { assigned_employee_id: serviceOrder.assigned_employee_id },
    });

    return serviceOrder;
  }

  async cancel(id: string) {
    const serviceOrder = await this.findOne(id);

    // Delete image from storage if exists
    if (serviceOrder.image_url) {
      try {
        await this.storageService.deleteFile(serviceOrder.image_url, 'service-orders');
      } catch (error) {
        console.warn('Failed to delete service order image:', error);
      }
    }

    return this.prisma.service_orders.update({
      where: { id },
      data: {
        status: 'cancelled',
        updated_at: new Date(),
      },
    });
  }

  async getBikesInServiceCount() {
    const count = await this.prisma.service_orders.count({
      where: {
        status: {
          notIn: ['delivered', 'cancelled'],
        },
      },
    });

    return { count };
  }

  async getDashboardStats() {
    // Bikes in service (not delivered or cancelled)
    const bikesInService = await this.prisma.service_orders.count({
      where: {
        status: {
          notIn: ['delivered', 'cancelled'],
        },
      },
    });

    // Completed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = await this.prisma.service_orders.count({
      where: {
        status: 'completed',
        actual_completion_date: {
          gte: today,
        },
      },
    });

    // Pending
    const pending = await this.prisma.service_orders.count({
      where: {
        status: 'pending',
      },
    });

    return {
      bikesInService,
      completedToday,
      pending,
    };
  }

  async uploadImage(
    id: string,
    file: Buffer | string,
    mimeType: string,
  ): Promise<string> {
    // Check if service order exists
    const serviceOrder = await this.findOne(id);

    // Upload new image (or replace existing)
    const imageUrl = serviceOrder.image_url
      ? await this.storageService.replaceFile(
          serviceOrder.image_url,
          file,
          'service-orders',
          mimeType,
        )
      : await this.storageService.uploadFile(file, 'service-orders', mimeType);

    // Update service order record with image URL
    await this.prisma.service_orders.update({
      where: { id },
      data: {
        image_url: imageUrl,
        updated_at: new Date(),
      },
    });

    return imageUrl;
  }

  async deleteImage(id: string): Promise<void> {
    // Check if service order exists
    const serviceOrder = await this.findOne(id);

    if (!serviceOrder.image_url) {
      throw new NotFoundException('Service order does not have an image');
    }

    // Delete image from storage
    await this.storageService.deleteFile(serviceOrder.image_url, 'service-orders');

    // Update service order record to remove image URL
    await this.prisma.service_orders.update({
      where: { id },
      data: {
        image_url: null,
        updated_at: new Date(),
      },
    });
  }
}
