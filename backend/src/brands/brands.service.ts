import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.brands.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        is_active: true,
      },
    });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brands.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async create(createBrandDto: CreateBrandDto) {
    return this.prisma.brands.create({
      data: createBrandDto,
    });
  }

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    try {
      return await this.prisma.brands.update({
        where: { id },
        data: updateBrandDto,
      });
    } catch (error) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.brands.delete({
        where: { id },
      });
      return { message: 'Brand deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }
  }
}
