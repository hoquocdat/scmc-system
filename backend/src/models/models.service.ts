import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelsService {
  constructor(private prisma: PrismaService) {}

  async create(createModelDto: CreateModelDto) {
    return this.prisma.models.create({
      data: createModelDto,
      include: {
        brands: {
          select: {
            id: true,
            name: true,
            country_of_origin: true,
          },
        },
      },
    });
  }

  async findAll(brandId?: string) {
    return this.prisma.models.findMany({
      where: {
        is_active: true,
        ...(brandId && { brand_id: brandId }),
      },
      include: {
        brands: {
          select: {
            id: true,
            name: true,
            country_of_origin: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const model = await this.prisma.models.findUnique({
      where: { id },
      include: {
        brands: {
          select: {
            id: true,
            name: true,
            country_of_origin: true,
          },
        },
      },
    });

    if (!model) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }

    return model;
  }

  async findByBrandName(brandName: string) {
    return this.prisma.models.findMany({
      where: {
        is_active: true,
        brands: {
          name: brandName,
        },
      },
      include: {
        brands: {
          select: {
            id: true,
            name: true,
            country_of_origin: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async update(id: string, updateModelDto: UpdateModelDto) {
    try {
      return await this.prisma.models.update({
        where: { id },
        data: updateModelDto,
        include: {
          brands: {
            select: {
              id: true,
              name: true,
              country_of_origin: true,
            },
          },
        },
      });
    } catch (error) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.models.delete({
        where: { id },
      });
      return { message: 'Model deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }
  }
}
