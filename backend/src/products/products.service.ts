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
import { CreateMasterProductDto, AddVariantsDto, FindVariantDto } from './dto/create-master-product.dto';
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

    // Date range filter
    if (filters.created_from || filters.created_to) {
      where.created_at = {};
      if (filters.created_from) {
        where.created_at.gte = new Date(filters.created_from);
      }
      if (filters.created_to) {
        where.created_at.lte = new Date(filters.created_to);
      }
    }

    // Stock status filter - needs to be applied after fetching products
    const needsStockFilter = filters.stock_status !== undefined;

    // Execute queries
    const [products, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        skip: needsStockFilter ? undefined : skip,
        take: needsStockFilter ? undefined : limit, // Fetch all if stock filter needed
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

    // Apply stock status filter if specified
    let filteredProducts = products;
    let filteredTotal = total;

    if (needsStockFilter) {
      filteredProducts = products.filter((product) => {
        // Calculate total stock across all locations
        const totalStock = product.inventory.reduce((sum, inv) => sum + (inv.quantity_on_hand || 0), 0);
        const reorderPoint = product.reorder_point || 0;

        switch (filters.stock_status) {
          case 'out_of_stock':
            return totalStock === 0;
          case 'in_stock':
            return totalStock > 0;
          case 'below_reorder':
            return reorderPoint > 0 && totalStock > 0 && totalStock <= reorderPoint;
          case 'above_reorder':
            return reorderPoint > 0 && totalStock > reorderPoint;
          default:
            return true;
        }
      });

      filteredTotal = filteredProducts.length;
      // Apply pagination after filtering
      filteredProducts = filteredProducts.slice(skip, skip + limit);
    }

    return {
      data: filteredProducts,
      meta: {
        total: filteredTotal,
        page,
        limit,
        totalPages: Math.ceil(filteredTotal / limit),
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

      // Filter out undefined values to preserve existing data
      const filteredData = Object.fromEntries(
        Object.entries(dtoData).filter(([_, value]) => value !== undefined)
      );

      // Convert decimal fields and date fields to proper format
      const data: Prisma.productsUpdateInput = {
        ...filteredData,
      };

      // Handle decimal conversions for provided fields
      if (updateProductDto.cost_price !== undefined) {
        data.cost_price = updateProductDto.cost_price ? new Prisma.Decimal(updateProductDto.cost_price) : null;
      }
      if (updateProductDto.retail_price !== undefined) {
        data.retail_price = new Prisma.Decimal(updateProductDto.retail_price);
      }
      if (updateProductDto.sale_price !== undefined) {
        data.sale_price = updateProductDto.sale_price ? new Prisma.Decimal(updateProductDto.sale_price) : null;
      }
      if (updateProductDto.weight !== undefined) {
        data.weight = updateProductDto.weight ? new Prisma.Decimal(updateProductDto.weight) : null;
      }
      if (updateProductDto.dimensions_length !== undefined) {
        data.dimensions_length = updateProductDto.dimensions_length ? new Prisma.Decimal(updateProductDto.dimensions_length) : null;
      }
      if (updateProductDto.dimensions_width !== undefined) {
        data.dimensions_width = updateProductDto.dimensions_width ? new Prisma.Decimal(updateProductDto.dimensions_width) : null;
      }
      if (updateProductDto.dimensions_height !== undefined) {
        data.dimensions_height = updateProductDto.dimensions_height ? new Prisma.Decimal(updateProductDto.dimensions_height) : null;
      }

      // Handle date conversions for provided fields
      if (updateProductDto.sale_price_start_date !== undefined) {
        data.sale_price_start_date = updateProductDto.sale_price_start_date ? new Date(updateProductDto.sale_price_start_date) : null;
      }
      if (updateProductDto.sale_price_end_date !== undefined) {
        data.sale_price_end_date = updateProductDto.sale_price_end_date ? new Date(updateProductDto.sale_price_end_date) : null;
      }

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

  /**
   * Create master product with automatic variant generation
   */
  async createMasterProductWithVariants(dto: CreateMasterProductDto) {
    try {
      // Check if SKU already exists
      const existingProduct = await this.prisma.products.findUnique({
        where: { sku: dto.sku },
      });

      if (existingProduct) {
        throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
      }

      // Extract variant attributes
      const { variantAttributes, ...masterProductData } = dto;

      // Destructure foreign keys
      const { category_id, brand_id, supplier_id, ...masterData } = masterProductData;

      // Prepare master product data
      const masterCreateData: Prisma.productsCreateInput = {
        ...masterData,
        is_master: true,
        variant_generation_type: 'automatic',
        attributes: {} as any, // Master doesn't have attributes
        cost_price: dto.cost_price ? new Prisma.Decimal(dto.cost_price) : undefined,
        retail_price: new Prisma.Decimal(dto.retail_price),
        sale_price: dto.sale_price ? new Prisma.Decimal(dto.sale_price) : undefined,
        sale_price_start_date: dto.sale_price_start_date ? new Date(dto.sale_price_start_date) : undefined,
        sale_price_end_date: dto.sale_price_end_date ? new Date(dto.sale_price_end_date) : undefined,
        weight: dto.weight ? new Prisma.Decimal(dto.weight) : undefined,
        dimensions_length: dto.dimensions_length ? new Prisma.Decimal(dto.dimensions_length) : undefined,
        dimensions_width: dto.dimensions_width ? new Prisma.Decimal(dto.dimensions_width) : undefined,
        dimensions_height: dto.dimensions_height ? new Prisma.Decimal(dto.dimensions_height) : undefined,
      };

      // Handle foreign key relations
      if (category_id) {
        masterCreateData.product_categories = { connect: { id: category_id } };
      }
      if (brand_id) {
        masterCreateData.brands = { connect: { id: brand_id } };
      }
      if (supplier_id) {
        masterCreateData.suppliers = { connect: { id: supplier_id } };
      }

      // Create master product
      const masterProduct = await this.prisma.products.create({
        data: masterCreateData,
        include: {
          product_categories: true,
          brands: true,
          suppliers: true,
        },
      });

      // Generate variant combinations
      const variantCombinations = this.generateVariantCombinations(variantAttributes);

      // Create variant products
      const variants = [];
      for (const attributes of variantCombinations) {
        const variantSuffix = this.generateVariantSuffix(attributes);
        const variantName = this.formatVariantName(dto.name, attributes);

        const variantData: Prisma.productsCreateInput = {
          sku: `${dto.sku}-${variantSuffix}`,
          name: variantName,
          description: dto.description,
          is_master: false,
          variant_generation_type: 'automatic',
          attributes: attributes as any,
          retail_price: masterProduct.retail_price,
          cost_price: masterProduct.cost_price,
          sale_price: masterProduct.sale_price,
          sale_price_start_date: masterProduct.sale_price_start_date,
          sale_price_end_date: masterProduct.sale_price_end_date,
          reorder_point: masterProduct.reorder_point,
          reorder_quantity: masterProduct.reorder_quantity,
          product_type: masterProduct.product_type,
          is_active: masterProduct.is_active,
          is_featured: masterProduct.is_featured,
          weight: masterProduct.weight,
          dimensions_length: masterProduct.dimensions_length,
          dimensions_width: masterProduct.dimensions_width,
          dimensions_height: masterProduct.dimensions_height,
          products: { connect: { id: masterProduct.id } }, // Link to master via master_product_id
        };

        // Connect foreign keys
        if (category_id) {
          variantData.product_categories = { connect: { id: category_id } };
        }
        if (brand_id) {
          variantData.brands = { connect: { id: brand_id } };
        }
        if (supplier_id) {
          variantData.suppliers = { connect: { id: supplier_id } };
        }

        const variant = await this.prisma.products.create({
          data: variantData,
        });

        variants.push(variant);
      }

      return {
        master: masterProduct,
        variants,
        variantsCreated: variants.length,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create master product with variants: ${error.message}`);
    }
  }

  /**
   * Get all variants of a master product
   */
  async getVariants(masterProductId: string) {
    // Verify master product exists
    const masterProduct = await this.prisma.products.findUnique({
      where: { id: masterProductId },
    });

    if (!masterProduct) {
      throw new NotFoundException(`Master product with ID "${masterProductId}" not found`);
    }

    if (!masterProduct.is_master) {
      throw new BadRequestException(`Product with ID "${masterProductId}" is not a master product`);
    }

    // Get all variants
    const variants = await this.prisma.products.findMany({
      where: {
        master_product_id: masterProductId,
        is_active: true,
      },
      include: {
        inventory: {
          select: {
            quantity_on_hand: true,
            quantity_reserved: true,
            location_id: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return variants;
  }

  /**
   * Find specific variant by attributes
   */
  async findVariantByAttributes(masterProductId: string, findVariantDto: FindVariantDto) {
    const variant = await this.prisma.products.findFirst({
      where: {
        master_product_id: masterProductId,
        attributes: {
          equals: findVariantDto.attributes as any,
        },
        is_active: true,
      },
      include: {
        inventory: {
          include: {
            stock_locations: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant with attributes ${JSON.stringify(findVariantDto.attributes)} not found for master product ${masterProductId}`,
      );
    }

    return variant;
  }

  /**
   * Search products by attributes (JSONB query)
   */
  async searchByAttributes(attributes: Record<string, any>) {
    const products = await this.prisma.products.findMany({
      where: {
        attributes: {
          path: [],
          equals: attributes as any,
        },
        is_active: true,
      },
      include: {
        product_categories: true,
        brands: true,
        suppliers: true,
        inventory: true,
      },
    });

    return products;
  }

  /**
   * Generate all variant combinations from attribute values
   * Example: {color: ['red', 'blue'], size: ['M', 'L']} =>
   * [{color: 'red', size: 'M'}, {color: 'red', size: 'L'}, {color: 'blue', size: 'M'}, {color: 'blue', size: 'L'}]
   */
  private generateVariantCombinations(
    variantAttributes: Record<string, string[]>,
  ): Record<string, string>[] {
    const attributeKeys = Object.keys(variantAttributes);
    const attributeValues = Object.values(variantAttributes);

    // Calculate cartesian product
    const cartesianProduct = attributeValues.reduce<string[][]>(
      (acc, values) => {
        return acc.flatMap((combination) =>
          values.map((value) => [...combination, value]),
        );
      },
      [[]],
    );

    // Convert to object format
    return cartesianProduct.map((combination) => {
      const obj: Record<string, string> = {};
      attributeKeys.forEach((key, index) => {
        obj[key] = combination[index];
      });
      return obj;
    });
  }

  /**
   * Generate SKU suffix from variant attributes
   * Example: {color: 'red', size: 'M'} => 'RED-M'
   */
  private generateVariantSuffix(attributes: Record<string, string>): string {
    return Object.values(attributes)
      .map((value) => value.toUpperCase())
      .join('-');
  }

  /**
   * Format variant name with attributes
   * Example: ('T-Shirt', {color: 'red', size: 'M'}) => 'T-Shirt (Red, M)'
   */
  private formatVariantName(
    baseName: string,
    attributes: Record<string, string>,
  ): string {
    const attrString = Object.values(attributes)
      .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
      .join(', ');
    return `${baseName} (${attrString})`;
  }
}
