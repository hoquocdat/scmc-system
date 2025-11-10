import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product_categories.findMany({
      where: {
        is_active: true,
      },
      include: {
        product_categories: {
          // parent category
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            products: true,
            other_product_categories: true, // child categories
          },
        },
      },
      orderBy: [
        { display_order: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.product_categories.findUnique({
      where: { id },
      include: {
        product_categories: {
          // parent category
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        other_product_categories: {
          // child categories
          select: {
            id: true,
            name: true,
            slug: true,
            display_order: true,
            is_active: true,
          },
          where: {
            is_active: true,
          },
          orderBy: [
            { display_order: 'asc' },
            { name: 'asc' },
          ],
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Product category with ID ${id} not found`);
    }

    return category;
  }

  async create(createProductCategoryDto: CreateProductCategoryDto) {
    return this.prisma.product_categories.create({
      data: {
        ...createProductCategoryDto,
        is_active: true,
      },
    });
  }

  async update(id: string, updateProductCategoryDto: UpdateProductCategoryDto) {
    await this.findOne(id); // Check if exists

    return this.prisma.product_categories.update({
      where: { id },
      data: {
        ...updateProductCategoryDto,
        updated_at: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists

    // Soft delete by setting is_active to false
    return this.prisma.product_categories.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });
  }
}
