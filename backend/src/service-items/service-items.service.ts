import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceItemDto } from './dto/update-service-item.dto';

@Injectable()
export class ServiceItemsService {
  constructor(private prisma: PrismaService) {}

  async create(createServiceItemDto: CreateServiceItemDto) {
    return this.prisma.service_items.create({
      data: {
        service_order_id: createServiceItemDto.service_order_id,
        name: createServiceItemDto.name,
        description: createServiceItemDto.description,
        status: createServiceItemDto.status as any,
        labor_cost: createServiceItemDto.labor_cost || 0,
        hours_worked: createServiceItemDto.hours_worked || 0,
        assigned_employee_id: createServiceItemDto.assigned_employee_id || null,
      },
    });
  }

  async findAll(serviceOrderId?: string) {
    return this.prisma.service_items.findMany({
      where: serviceOrderId ? { service_order_id: serviceOrderId } : undefined,
      orderBy: {
        created_at: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const serviceItem = await this.prisma.service_items.findUnique({
      where: { id },
    });

    if (!serviceItem) {
      throw new NotFoundException(`Service item with ID ${id} not found`);
    }

    return serviceItem;
  }

  async update(id: string, updateServiceItemDto: UpdateServiceItemDto) {
    try {
      const updateData: any = {};
      if (updateServiceItemDto.name !== undefined) updateData.name = updateServiceItemDto.name;
      if (updateServiceItemDto.description !== undefined) updateData.description = updateServiceItemDto.description;
      if (updateServiceItemDto.status !== undefined) updateData.status = updateServiceItemDto.status;
      if (updateServiceItemDto.labor_cost !== undefined) updateData.labor_cost = updateServiceItemDto.labor_cost;
      if (updateServiceItemDto.hours_worked !== undefined) updateData.hours_worked = updateServiceItemDto.hours_worked;
      if (updateServiceItemDto.assigned_employee_id !== undefined) updateData.assigned_employee_id = updateServiceItemDto.assigned_employee_id;

      return await this.prisma.service_items.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      throw new NotFoundException(`Service item with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.service_items.delete({
        where: { id },
      });
      return { message: 'Service item deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`Service item with ID ${id} not found`);
    }
  }
}
