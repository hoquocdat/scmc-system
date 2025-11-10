import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServicePartDto } from './dto/create-service-part.dto';
import { UpdateServicePartDto } from './dto/update-service-part.dto';

@Injectable()
export class ServicePartsService {
  constructor(private prisma: PrismaService) {}

  async create(createServicePartDto: CreateServicePartDto) {
    const totalCost = createServicePartDto.quantity_used * createServicePartDto.unit_cost;

    return this.prisma.service_parts.create({
      data: {
        ...createServicePartDto,
        total_cost: totalCost,
      },
    });
  }

  async findAll(serviceOrderId?: string) {
    return this.prisma.service_parts.findMany({
      where: serviceOrderId ? { service_order_id: serviceOrderId } : undefined,
      include: {
        parts: {
          select: {
            name: true,
            part_number: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const servicePart = await this.prisma.service_parts.findUnique({
      where: { id },
      include: {
        parts: {
          select: {
            name: true,
            part_number: true,
          },
        },
      },
    });

    if (!servicePart) {
      throw new NotFoundException(`Service part with ID ${id} not found`);
    }

    return servicePart;
  }

  async update(id: string, updateServicePartDto: UpdateServicePartDto) {
    const payload: any = { ...updateServicePartDto };

    if (updateServicePartDto.quantity_used !== undefined && updateServicePartDto.unit_cost !== undefined) {
      payload.total_cost = updateServicePartDto.quantity_used * updateServicePartDto.unit_cost;
    }

    try {
      return await this.prisma.service_parts.update({
        where: { id },
        data: payload,
      });
    } catch (error) {
      throw new NotFoundException(`Service part with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.service_parts.delete({
        where: { id },
      });
      return { message: 'Service part deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`Service part with ID ${id} not found`);
    }
  }
}
