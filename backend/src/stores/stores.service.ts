import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.stores.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
      include: {
        stock_locations: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const store = await this.prisma.stores.findUnique({
      where: { id },
      include: {
        stock_locations: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return store;
  }

  async create(dto: CreateStoreDto) {
    // Check if code already exists
    const existingCode = await this.prisma.stores.findFirst({
      where: { code: dto.code },
    });

    if (existingCode) {
      throw new ConflictException(`Store with code ${dto.code} already exists`);
    }

    // If this is set as default, unset other defaults
    if (dto.is_default) {
      await this.prisma.stores.updateMany({
        where: { is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.stores.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        city: dto.city,
        phone: dto.phone,
        email: dto.email,
        is_active: dto.is_active ?? true,
        is_default: dto.is_default ?? false,
        default_warehouse_id: dto.default_warehouse_id,
      },
      include: {
        stock_locations: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateStoreDto) {
    // Check if store exists
    await this.findOne(id);

    // Check if new code conflicts
    if (dto.code) {
      const existingCode = await this.prisma.stores.findFirst({
        where: { code: dto.code, NOT: { id } },
      });

      if (existingCode) {
        throw new ConflictException(`Store with code ${dto.code} already exists`);
      }
    }

    // If this is set as default, unset other defaults
    if (dto.is_default) {
      await this.prisma.stores.updateMany({
        where: { is_default: true, NOT: { id } },
        data: { is_default: false },
      });
    }

    return this.prisma.stores.update({
      where: { id },
      data: dto,
      include: {
        stock_locations: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    // Check if store exists
    await this.findOne(id);

    // Check if store is used in any sales orders
    const usedInSales = await this.prisma.sales_orders.count({
      where: { store_id: id },
    });

    if (usedInSales > 0) {
      throw new ConflictException(
        `Cannot delete store. It is used in ${usedInSales} sales orders.`,
      );
    }

    // Check if store is used in any service orders
    const usedInService = await this.prisma.service_orders.count({
      where: { store_id: id },
    });

    if (usedInService > 0) {
      throw new ConflictException(
        `Cannot delete store. It is used in ${usedInService} service orders.`,
      );
    }

    return this.prisma.stores.delete({
      where: { id },
    });
  }
}
