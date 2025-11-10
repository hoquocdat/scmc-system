import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto) {
    return this.prisma.suppliers.create({
      data: createSupplierDto,
    });
  }

  async findAll() {
    return this.prisma.suppliers.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        is_active: true,
      },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    try {
      return await this.prisma.suppliers.update({
        where: { id },
        data: updateSupplierDto,
      });
    } catch (error) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.suppliers.delete({
        where: { id },
      });
      return { message: 'Supplier deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
  }
}
