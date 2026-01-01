import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockLocationDto } from './dto/create-stock-location.dto';
import { UpdateStockLocationDto } from './dto/update-stock-location.dto';

@Injectable()
export class StockLocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.stock_locations.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const location = await this.prisma.stock_locations.findUnique({
      where: { id },
    });

    if (!location) {
      throw new NotFoundException(`Stock location with ID ${id} not found`);
    }

    return location;
  }

  async create(dto: CreateStockLocationDto) {
    // Check if code already exists
    const existingCode = await this.prisma.stock_locations.findFirst({
      where: { code: dto.code },
    });

    if (existingCode) {
      throw new ConflictException(`Location with code ${dto.code} already exists`);
    }

    // If this is set as default, unset other defaults
    if (dto.is_default) {
      await this.prisma.stock_locations.updateMany({
        where: { is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.stock_locations.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        city: dto.city,
        phone: dto.phone,
        is_active: dto.is_active ?? true,
        is_default: dto.is_default ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateStockLocationDto) {
    // Check if location exists
    await this.findOne(id);

    // Check if new code conflicts
    if (dto.code) {
      const existingCode = await this.prisma.stock_locations.findFirst({
        where: { code: dto.code, NOT: { id } },
      });

      if (existingCode) {
        throw new ConflictException(`Location with code ${dto.code} already exists`);
      }
    }

    // If this is set as default, unset other defaults
    if (dto.is_default) {
      await this.prisma.stock_locations.updateMany({
        where: { is_default: true, NOT: { id } },
        data: { is_default: false },
      });
    }

    return this.prisma.stock_locations.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    // Check if location exists
    await this.findOne(id);

    // Check if location is used in any sales orders or inventory
    const usedInSales = await this.prisma.sales_orders.count({
      where: { location_id: id },
    });

    if (usedInSales > 0) {
      throw new ConflictException(
        `Cannot delete location. It is used in ${usedInSales} sales orders.`,
      );
    }

    return this.prisma.stock_locations.delete({
      where: { id },
    });
  }
}
