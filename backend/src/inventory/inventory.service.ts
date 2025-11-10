import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryTransactionDto, InventoryTransactionType } from './dto/create-inventory-transaction.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: InventoryQueryDto) {
    const { page = 1, limit = 20, sort_by = 'updated_at', sort_order = 'desc', ...filters } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.inventoryWhereInput = {};

    if (filters.location_id) {
      where.location_id = filters.location_id;
    }
    if (filters.product_id) {
      where.product_id = filters.product_id;
    }

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by as string]: sort_order },
        include: {
          stock_locations: true,
          products: true,
          product_variants: true,
        },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: {
        stock_locations: true,
        products: true,
        product_variants: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory record with ID "${id}" not found`);
    }

    return inventory;
  }

  async findByLocationAndProduct(locationId: string, productId: string, variantId?: string) {
    const where: Prisma.inventoryWhereInput = {
      location_id: locationId,
    };

    if (variantId) {
      where.product_variant_id = variantId;
    } else {
      where.product_id = productId;
      where.product_variant_id = null;
    }

    const inventory = await this.prisma.inventory.findFirst({
      where,
      include: {
        stock_locations: true,
        products: true,
        product_variants: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        `Inventory record not found for location "${locationId}" and product "${productId}"${variantId ? ` variant "${variantId}"` : ''}`,
      );
    }

    return inventory;
  }

  async update(id: string, updateInventoryDto: UpdateInventoryDto) {
    try {
      await this.findOne(id);

      const inventory = await this.prisma.inventory.update({
        where: { id },
        data: updateInventoryDto,
        include: {
          stock_locations: true,
          products: true,
          product_variants: true,
        },
      });

      return inventory;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update inventory: ${error.message}`);
    }
  }

  async createTransaction(createTransactionDto: CreateInventoryTransactionDto) {
    try {
      // Validate that either product_id or product_variant_id is provided
      if (!createTransactionDto.product_id && !createTransactionDto.product_variant_id) {
        throw new BadRequestException('Either product_id or product_variant_id must be provided');
      }

      // Convert unit_cost to Decimal if provided
      const data: Prisma.inventory_transactionsCreateInput = {
        transaction_type: createTransactionDto.transaction_type,
        quantity: createTransactionDto.quantity,
        unit_cost: createTransactionDto.unit_cost
          ? new Prisma.Decimal(createTransactionDto.unit_cost)
          : undefined,
        reference_id: createTransactionDto.reference_id,
        reference_type: createTransactionDto.reference_type,
        notes: createTransactionDto.notes,
        stock_locations: {
          connect: { id: createTransactionDto.location_id },
        },
      };

      if (createTransactionDto.product_id) {
        data.products = { connect: { id: createTransactionDto.product_id } };
      }

      if (createTransactionDto.product_variant_id) {
        data.product_variants = { connect: { id: createTransactionDto.product_variant_id } };
      }

      if (createTransactionDto.performed_by) {
        data.user_profiles = { connect: { id: createTransactionDto.performed_by } };
      }

      // Create the transaction (database trigger will automatically update inventory)
      const transaction = await this.prisma.inventory_transactions.create({
        data,
        include: {
          stock_locations: true,
          products: true,
          product_variants: true,
          user_profiles: true,
        },
      });

      return transaction;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create inventory transaction: ${error.message}`);
    }
  }

  async getTransactionHistory(
    locationId?: string,
    productId?: string,
    variantId?: string,
    page = 1,
    limit = 50,
  ) {
    const where: Prisma.inventory_transactionsWhereInput = {};

    if (locationId) {
      where.location_id = locationId;
    }
    if (productId) {
      where.product_id = productId;
    }
    if (variantId) {
      where.product_variant_id = variantId;
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.inventory_transactions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          stock_locations: true,
          products: true,
          product_variants: true,
          user_profiles: true,
        },
      }),
      this.prisma.inventory_transactions.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStockLevels(locationId?: string) {
    const where: Prisma.inventoryWhereInput = {};

    if (locationId) {
      where.location_id = locationId;
    }

    const inventory = await this.prisma.inventory.findMany({
      where,
      include: {
        stock_locations: true,
        products: {
          include: {
            product_categories: true,
          },
        },
        product_variants: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    // Calculate available quantity (on hand - reserved)
    const enrichedInventory = inventory.map((item) => ({
      ...item,
      quantity_available: (item.quantity_on_hand || 0) - (item.quantity_reserved || 0),
      is_low_stock: (item.quantity_on_hand || 0) <= (item.safety_stock || 0),
      needs_reorder:
        item.products?.reorder_point && (item.quantity_on_hand || 0) <= item.products.reorder_point,
    }));

    return enrichedInventory;
  }

  async adjustStock(
    locationId: string,
    productId: string,
    quantity: number,
    reason: string,
    performedBy?: string,
    variantId?: string,
  ) {
    return this.createTransaction({
      transaction_type: InventoryTransactionType.ADJUST,
      location_id: locationId,
      product_id: productId,
      product_variant_id: variantId,
      quantity,
      notes: reason,
      performed_by: performedBy,
    });
  }
}
