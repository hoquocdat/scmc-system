import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierReturnDto } from './dto/create-supplier-return.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierReturnsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a unique return number
   */
  private async generateReturnNumber(): Promise<string> {
    const prefix = 'SR';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Find the last return number for this month
    const lastReturn = await this.prisma.supplier_returns.findFirst({
      where: {
        return_number: {
          startsWith: `${prefix}${year}${month}`,
        },
      },
      orderBy: {
        return_number: 'desc',
      },
    });

    let sequence = 1;
    if (lastReturn) {
      const lastSequence = parseInt(lastReturn.return_number.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Get default stock location
   */
  private async getDefaultLocationId(tx: Prisma.TransactionClient): Promise<string> {
    const defaultLocation = await tx.stock_locations.findFirst({
      where: {
        OR: [
          { is_default: true },
          { code: 'MAIN' },
        ],
      },
    });

    if (!defaultLocation) {
      throw new BadRequestException('No default stock location found');
    }

    return defaultLocation.id;
  }

  /**
   * Create a supplier return
   */
  async create(dto: CreateSupplierReturnDto, userId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: dto.supplier_id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${dto.supplier_id} not found`);
    }

    // Verify purchase order exists and belongs to supplier
    const purchaseOrder = await this.prisma.purchase_orders.findUnique({
      where: { id: dto.purchase_order_id },
      include: {
        purchase_order_items: true,
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order with ID ${dto.purchase_order_id} not found`);
    }

    if (purchaseOrder.supplier_id !== dto.supplier_id) {
      throw new BadRequestException(
        `Purchase Order ${dto.purchase_order_id} does not belong to supplier ${dto.supplier_id}`
      );
    }

    if (purchaseOrder.status !== 'approved') {
      throw new BadRequestException(
        `Cannot create return for purchase order in ${purchaseOrder.status} status. Only approved orders can be returned.`
      );
    }

    // Validate all return items
    for (const item of dto.items) {
      const poItem = await this.prisma.purchase_order_items.findUnique({
        where: { id: item.purchase_order_item_id },
      });

      if (!poItem) {
        throw new NotFoundException(`Purchase Order Item with ID ${item.purchase_order_item_id} not found`);
      }

      if (poItem.purchase_order_id !== dto.purchase_order_id) {
        throw new BadRequestException(
          `Purchase Order Item ${item.purchase_order_item_id} does not belong to Purchase Order ${dto.purchase_order_id}`
        );
      }

      // Validate return quantity doesn't exceed received quantity
      const alreadyReturned = poItem.quantity_returned || 0;
      const maxReturnableQuantity = poItem.quantity_received - alreadyReturned;

      if (item.quantity_returned > maxReturnableQuantity) {
        throw new BadRequestException(
          `Cannot return ${item.quantity_returned} units. Maximum returnable quantity is ${maxReturnableQuantity} (received: ${poItem.quantity_received}, already returned: ${alreadyReturned})`
        );
      }
    }

    const returnNumber = await this.generateReturnNumber();

    return this.prisma.$transaction(async (tx) => {
      // Create supplier return
      const supplierReturn = await tx.supplier_returns.create({
        data: {
          return_number: returnNumber,
          supplier_id: dto.supplier_id,
          purchase_order_id: dto.purchase_order_id,
          return_date: dto.return_date ? new Date(dto.return_date) : new Date(),
          reason: dto.reason,
          notes: dto.notes,
          status: 'pending',
          created_by_id: userId,
        },
      });

      // Create return items
      for (const item of dto.items) {
        const poItem = await tx.purchase_order_items.findUnique({
          where: { id: item.purchase_order_item_id },
        });

        const totalCost = new Prisma.Decimal(poItem.unit_cost).mul(item.quantity_returned);

        await tx.supplier_return_items.create({
          data: {
            supplier_return_id: supplierReturn.id,
            purchase_order_item_id: item.purchase_order_item_id,
            product_id: poItem.product_id,
            product_variant_id: poItem.product_variant_id,
            quantity_returned: item.quantity_returned,
            unit_cost: poItem.unit_cost,
            total_cost: totalCost,
            reason: item.reason,
          },
        });
      }

      return this.findOne(supplierReturn.id);
    });
  }

  /**
   * Approve a supplier return and update stock
   */
  async approve(id: string, userId: string) {
    const supplierReturn = await this.findOne(id);

    if (supplierReturn.status !== 'pending') {
      throw new BadRequestException(
        `Cannot approve return in ${supplierReturn.status} status`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update return status
      const approved = await tx.supplier_returns.update({
        where: { id },
        data: {
          status: 'approved',
          approved_by_id: userId,
          updated_at: new Date(),
        },
      });

      // Update purchase order items and decrease stock
      for (const item of supplierReturn.supplier_return_items) {
        // Update PO item quantity_returned
        await tx.purchase_order_items.update({
          where: { id: item.purchase_order_item_id },
          data: {
            quantity_returned: {
              increment: item.quantity_returned,
            },
          },
        });

        // Decrease stock
        if (item.product_id) {
          // Create inventory transaction
          await tx.inventory_transactions.create({
            data: {
              location_id: await this.getDefaultLocationId(tx),
              product_id: item.product_id,
              transaction_type: 'return',
              quantity: -item.quantity_returned, // Negative because we're decreasing stock
              unit_cost: item.unit_cost,
              total_cost: item.total_cost,
              reference_type: 'supplier_return',
              reference_id: id,
              reason_code: 'supplier_return',
              notes: item.reason,
              created_by: userId,
            },
          });

          // Update inventory quantity
          const defaultLocationId = await this.getDefaultLocationId(tx);
          const existingInventory = await tx.inventory.findFirst({
            where: {
              location_id: defaultLocationId,
              product_id: item.product_id,
            },
          });

          if (existingInventory) {
            await tx.inventory.update({
              where: { id: existingInventory.id },
              data: {
                quantity_on_hand: {
                  decrement: item.quantity_returned,
                },
              },
            });
          } else {
            throw new BadRequestException(
              `No inventory record found for product ${item.product_id}`
            );
          }
        } else if (item.product_variant_id) {
          // Create inventory transaction for variant
          await tx.inventory_transactions.create({
            data: {
              location_id: await this.getDefaultLocationId(tx),
              product_variant_id: item.product_variant_id,
              transaction_type: 'return',
              quantity: -item.quantity_returned,
              unit_cost: item.unit_cost,
              total_cost: item.total_cost,
              reference_type: 'supplier_return',
              reference_id: id,
              reason_code: 'supplier_return',
              notes: item.reason,
              created_by: userId,
            },
          });

          // Update inventory quantity
          const defaultLocationId = await this.getDefaultLocationId(tx);
          const existingInventory = await tx.inventory.findFirst({
            where: {
              location_id: defaultLocationId,
              product_variant_id: item.product_variant_id,
            },
          });

          if (existingInventory) {
            await tx.inventory.update({
              where: { id: existingInventory.id },
              data: {
                quantity_on_hand: {
                  decrement: item.quantity_returned,
                },
              },
            });
          } else {
            throw new BadRequestException(
              `No inventory record found for product variant ${item.product_variant_id}`
            );
          }
        }
      }

      return this.findOne(id);
    });
  }

  /**
   * Find all returns for a supplier
   */
  async findBySupplier(supplierId: string) {
    return this.prisma.supplier_returns.findMany({
      where: {
        supplier_id: supplierId,
      },
      include: {
        suppliers: true,
        purchase_orders: true,
        supplier_return_items: {
          include: {
            purchase_order_items: true,
            products: true,
            product_variants: true,
          },
        },
        user_profiles_supplier_returns_created_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_supplier_returns_approved_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        return_date: 'desc',
      },
    });
  }

  /**
   * Find one return by ID
   */
  async findOne(id: string) {
    const supplierReturn = await this.prisma.supplier_returns.findUnique({
      where: { id },
      include: {
        suppliers: true,
        purchase_orders: true,
        supplier_return_items: {
          include: {
            purchase_order_items: true,
            products: true,
            product_variants: true,
          },
        },
        user_profiles_supplier_returns_created_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_supplier_returns_approved_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    if (!supplierReturn) {
      throw new NotFoundException(`Supplier Return with ID ${id} not found`);
    }

    return supplierReturn;
  }

  /**
   * Get all returns (with optional filtering)
   */
  async findAll(supplierId?: string, status?: string, startDate?: string, endDate?: string) {
    const where: Prisma.supplier_returnsWhereInput = {};

    if (supplierId) {
      where.supplier_id = supplierId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.return_date = {};
      if (startDate) {
        where.return_date.gte = new Date(startDate);
      }
      if (endDate) {
        where.return_date.lte = new Date(endDate);
      }
    }

    return this.prisma.supplier_returns.findMany({
      where,
      include: {
        suppliers: true,
        purchase_orders: true,
        supplier_return_items: {
          include: {
            purchase_order_items: true,
            products: true,
            product_variants: true,
          },
        },
        user_profiles_supplier_returns_created_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_supplier_returns_approved_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        return_date: 'desc',
      },
    });
  }
}
