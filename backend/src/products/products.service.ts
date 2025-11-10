import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    try {
      // Check if SKU already exists
      const existingProduct = await this.prisma.products.findUnique({
        where: { sku: createProductDto.sku },
      });

      if (existingProduct) {
        throw new ConflictException(`Product with SKU "${createProductDto.sku}" already exists`);
      }

      // Destructure to exclude foreign key fields
      const { category_id, brand_id, supplier_id, ...dtoData } = createProductDto;

      // Convert decimal fields and date fields to proper format
      const data: Prisma.productsCreateInput = {
        ...dtoData,
        cost_price: createProductDto.cost_price ? new Prisma.Decimal(createProductDto.cost_price) : undefined,
        retail_price: new Prisma.Decimal(createProductDto.retail_price),
        sale_price: createProductDto.sale_price ? new Prisma.Decimal(createProductDto.sale_price) : undefined,
        sale_price_start_date: createProductDto.sale_price_start_date ? new Date(createProductDto.sale_price_start_date) : undefined,
        sale_price_end_date: createProductDto.sale_price_end_date ? new Date(createProductDto.sale_price_end_date) : undefined,
        weight: createProductDto.weight ? new Prisma.Decimal(createProductDto.weight) : undefined,
        dimensions_length: createProductDto.dimensions_length ? new Prisma.Decimal(createProductDto.dimensions_length) : undefined,
        dimensions_width: createProductDto.dimensions_width ? new Prisma.Decimal(createProductDto.dimensions_width) : undefined,
        dimensions_height: createProductDto.dimensions_height ? new Prisma.Decimal(createProductDto.dimensions_height) : undefined,
      };

      // Handle foreign key relations
      if (category_id) {
        data.product_categories = { connect: { id: category_id } };
      }
      if (brand_id) {
        data.brands = { connect: { id: brand_id } };
      }
      if (supplier_id) {
        data.suppliers = { connect: { id: supplier_id } };
      }

      const product = await this.prisma.products.create({
        data,
        include: {
          product_categories: true,
          brands: true,
          suppliers: true,
        },
      });

      return product;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create product: ${error.message}`);
    }
  }

  async findAll(query: ProductQueryDto) {
    const { page = 1, limit = 20, search, sort_by = 'created_at', sort_order = 'desc', ...filters } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.productsWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters.category_id) {
      where.category_id = filters.category_id;
    }
    if (filters.brand_id) {
      where.brand_id = filters.brand_id;
    }
    if (filters.supplier_id) {
      where.supplier_id = filters.supplier_id;
    }
    if (filters.product_type) {
      where.product_type = filters.product_type;
    }
    if (filters.is_active !== undefined) {
      where.is_active = filters.is_active;
    }
    if (filters.is_featured !== undefined) {
      where.is_featured = filters.is_featured;
    }

    // Execute queries
    const [products, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by as string]: sort_order },
        include: {
          product_categories: true,
          brands: true,
          suppliers: true,
          product_variants: true,
          inventory: {
            select: {
              quantity_on_hand: true,
              quantity_reserved: true,
              location_id: true,
            },
          },
        },
      }),
      this.prisma.products.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: {
        product_categories: true,
        brands: true,
        suppliers: true,
        product_variants: true,
        inventory: {
          include: {
            stock_locations: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      // Check if product exists
      await this.findOne(id);

      // If SKU is being updated, check for conflicts
      if (updateProductDto.sku) {
        const existingProduct = await this.prisma.products.findUnique({
          where: { sku: updateProductDto.sku },
        });

        if (existingProduct && existingProduct.id !== id) {
          throw new ConflictException(`Product with SKU "${updateProductDto.sku}" already exists`);
        }
      }

      // Destructure to exclude foreign key fields
      const { category_id, brand_id, supplier_id, ...dtoData } = updateProductDto;

      // Convert decimal fields and date fields to proper format
      const data: Prisma.productsUpdateInput = {
        ...dtoData,
        cost_price: updateProductDto.cost_price ? new Prisma.Decimal(updateProductDto.cost_price) : undefined,
        retail_price: updateProductDto.retail_price ? new Prisma.Decimal(updateProductDto.retail_price) : undefined,
        sale_price: updateProductDto.sale_price ? new Prisma.Decimal(updateProductDto.sale_price) : undefined,
        sale_price_start_date: updateProductDto.sale_price_start_date ? new Date(updateProductDto.sale_price_start_date) : undefined,
        sale_price_end_date: updateProductDto.sale_price_end_date ? new Date(updateProductDto.sale_price_end_date) : undefined,
        weight: updateProductDto.weight ? new Prisma.Decimal(updateProductDto.weight) : undefined,
        dimensions_length: updateProductDto.dimensions_length ? new Prisma.Decimal(updateProductDto.dimensions_length) : undefined,
        dimensions_width: updateProductDto.dimensions_width ? new Prisma.Decimal(updateProductDto.dimensions_width) : undefined,
        dimensions_height: updateProductDto.dimensions_height ? new Prisma.Decimal(updateProductDto.dimensions_height) : undefined,
      };

      // Handle foreign key relations
      if (category_id) {
        data.product_categories = { connect: { id: category_id } };
      }
      if (brand_id) {
        data.brands = { connect: { id: brand_id } };
      }
      if (supplier_id) {
        data.suppliers = { connect: { id: supplier_id } };
      }

      const product = await this.prisma.products.update({
        where: { id },
        data,
        include: {
          product_categories: true,
          brands: true,
          suppliers: true,
        },
      });

      return product;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update product: ${error.message}`);
    }
  }

  async remove(id: string) {
    try {
      // Check if product exists
      await this.findOne(id);

      // Soft delete by setting is_active to false
      const product = await this.prisma.products.update({
        where: { id },
        data: { is_active: false },
      });

      return product;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete product: ${error.message}`);
    }
  }

  async getLowStockProducts(locationId?: string) {
    const where: Prisma.inventoryWhereInput = {
      products: {
        is_active: true,
        reorder_point: { gt: 0 },
      },
    };

    if (locationId) {
      where.location_id = locationId;
    }

    const inventory = await this.prisma.inventory.findMany({
      where,
      include: {
        products: true,
        product_variants: true,
        stock_locations: true,
      },
    });

    // Filter for low stock (quantity <= reorder point)
    const lowStockItems = inventory.filter(
      (item) =>
        (item.quantity_on_hand || 0) <= (item.products?.reorder_point || 0),
    );

    return lowStockItems;
  }
}
