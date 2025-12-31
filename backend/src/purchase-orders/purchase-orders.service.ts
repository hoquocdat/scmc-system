import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AddPurchaseOrderItemDto } from './dto/add-purchase-order-item.dto';
import { UpdatePurchaseOrderItemDto } from './dto/update-purchase-order-item.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a unique purchase order number
   */
  private async generateOrderNumber(): Promise<string> {
    const prefix = 'PO';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Find the last order number for this month
    const lastOrder = await this.prisma.purchase_orders.findFirst({
      where: {
        order_number: {
          startsWith: `${prefix}${year}${month}`,
        },
      },
      orderBy: {
        order_number: 'desc',
      },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.order_number.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new purchase order
   */
  async create(dto: CreatePurchaseOrderDto, userId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: dto.supplier_id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${dto.supplier_id} not found`);
    }

    const orderNumber = await this.generateOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      // Create purchase order
      const purchaseOrder = await tx.purchase_orders.create({
        data: {
          order_number: orderNumber,
          supplier_id: dto.supplier_id,
          expected_delivery_date: dto.expected_delivery_date
            ? new Date(dto.expected_delivery_date)
            : null,
          tax_amount: dto.tax_amount ? new Prisma.Decimal(dto.tax_amount) : new Prisma.Decimal(0),
          shipping_cost: dto.shipping_cost ? new Prisma.Decimal(dto.shipping_cost) : new Prisma.Decimal(0),
          discount_amount: dto.discount_amount ? new Prisma.Decimal(dto.discount_amount) : new Prisma.Decimal(0),
          notes: dto.notes,
          internal_notes: dto.internal_notes,
          created_by_id: userId || null,
          updated_by_id: userId || null,
        },
        include: {
          suppliers: true,
        },
      });

      // Create purchase order items if provided
      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await this.addItem(purchaseOrder.id, item, userId, tx);
        }
      }

      // Fetch the complete purchase order with all relations within the transaction
      return tx.purchase_orders.findUnique({
        where: { id: purchaseOrder.id },
        include: {
          suppliers: true,
          purchase_order_items: {
            include: {
              products: true,
              product_variants: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
          user_profiles_purchase_orders_created_by_idTouser_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
          user_profiles_purchase_orders_updated_by_idTouser_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });
    });
  }

  /**
   * Find all purchase orders with filters
   */
  async findAll(query: PurchaseOrderQueryDto) {
    const where: Prisma.purchase_ordersWhereInput = {};

    if (query.search) {
      where.OR = [
        { order_number: { contains: query.search, mode: 'insensitive' } },
        { suppliers: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.supplier_id) {
      where.supplier_id = query.supplier_id;
    }

    if (query.status) {
      where.status = query.status as any;
    }

    if (query.payment_status) {
      where.payment_status = query.payment_status as any;
    }

    if (query.order_date_from || query.order_date_to) {
      where.order_date = {};
      if (query.order_date_from) {
        where.order_date.gte = new Date(query.order_date_from);
      }
      if (query.order_date_to) {
        where.order_date.lte = new Date(query.order_date_to);
      }
    }

    const purchaseOrders = await this.prisma.purchase_orders.findMany({
      where,
      include: {
        suppliers: true,
        purchase_order_items: {
          include: {
            products: true,
            product_variants: true,
          },
        },
        user_profiles_purchase_orders_created_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_purchase_orders_approved_byTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return purchaseOrders;
  }

  /**
   * Find one purchase order by ID
   */
  async findOne(id: string) {
    const purchaseOrder = await this.prisma.purchase_orders.findUnique({
      where: { id },
      include: {
        suppliers: true,
        purchase_order_items: {
          include: {
            products: true,
            product_variants: true,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
        user_profiles_purchase_orders_created_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_purchase_orders_updated_by_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_purchase_orders_approved_byTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        user_profiles_purchase_orders_submitted_byTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        supplier_payment_allocations: {
          include: {
            supplier_payments: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    return purchaseOrder;
  }

  /**
   * Update a purchase order (only in draft status)
   */
  async update(id: string, dto: UpdatePurchaseOrderDto, userId: string) {
    const existing = await this.findOne(id);

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        `Cannot update purchase order in ${existing.status} status. Only draft orders can be updated.`
      );
    }

    return this.prisma.purchase_orders.update({
      where: { id },
      data: {
        expected_delivery_date: dto.expected_delivery_date
          ? new Date(dto.expected_delivery_date)
          : undefined,
        tax_amount: dto.tax_amount !== undefined ? new Prisma.Decimal(dto.tax_amount) : undefined,
        shipping_cost: dto.shipping_cost !== undefined ? new Prisma.Decimal(dto.shipping_cost) : undefined,
        discount_amount: dto.discount_amount !== undefined ? new Prisma.Decimal(dto.discount_amount) : undefined,
        notes: dto.notes,
        internal_notes: dto.internal_notes,
        updated_by_id: userId,
      },
      include: {
        suppliers: true,
        purchase_order_items: true,
      },
    });
  }

  /**
   * Add an item to a purchase order
   */
  async addItem(
    purchaseOrderId: string,
    dto: AddPurchaseOrderItemDto,
    userId: string,
    tx?: Prisma.TransactionClient
  ) {
    const prisma = tx || this.prisma;

    const purchaseOrder = await prisma.purchase_orders.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order with ID ${purchaseOrderId} not found`);
    }

    if (purchaseOrder.status !== 'draft') {
      throw new BadRequestException(
        `Cannot add items to purchase order in ${purchaseOrder.status} status`
      );
    }

    // Calculate total cost
    const totalCost = new Prisma.Decimal(dto.unit_cost).mul(dto.quantity_ordered);

    return prisma.purchase_order_items.create({
      data: {
        purchase_order_id: purchaseOrderId,
        product_id: dto.product_id,
        product_variant_id: dto.product_variant_id,
        product_name: dto.product_name,
        product_sku: dto.product_sku,
        variant_name: dto.variant_name,
        quantity_ordered: dto.quantity_ordered,
        unit_cost: new Prisma.Decimal(dto.unit_cost),
        total_cost: totalCost,
        notes: dto.notes,
      },
      include: {
        products: true,
        product_variants: true,
      },
    });
  }

  /**
   * Update a purchase order item
   */
  async updateItem(
    purchaseOrderId: string,
    itemId: string,
    dto: UpdatePurchaseOrderItemDto,
    userId: string
  ) {
    const purchaseOrder = await this.findOne(purchaseOrderId);

    if (purchaseOrder.status !== 'draft') {
      throw new BadRequestException(
        `Cannot update items for purchase order in ${purchaseOrder.status} status`
      );
    }

    const item = await this.prisma.purchase_order_items.findUnique({
      where: { id: itemId },
    });

    if (!item || item.purchase_order_id !== purchaseOrderId) {
      throw new NotFoundException(`Purchase Order Item with ID ${itemId} not found`);
    }

    // Recalculate total cost if quantity or unit cost changes
    const quantity = dto.quantity_ordered !== undefined ? dto.quantity_ordered : item.quantity_ordered;
    const unitCost = dto.unit_cost !== undefined ? new Prisma.Decimal(dto.unit_cost) : item.unit_cost;
    const totalCost = new Prisma.Decimal(unitCost).mul(quantity);

    return this.prisma.purchase_order_items.update({
      where: { id: itemId },
      data: {
        product_name: dto.product_name,
        product_sku: dto.product_sku,
        variant_name: dto.variant_name,
        quantity_ordered: dto.quantity_ordered,
        unit_cost: dto.unit_cost !== undefined ? new Prisma.Decimal(dto.unit_cost) : undefined,
        total_cost: totalCost,
        notes: dto.notes,
      },
      include: {
        products: true,
        product_variants: true,
      },
    });
  }

  /**
   * Remove an item from a purchase order
   */
  async removeItem(purchaseOrderId: string, itemId: string, userId: string) {
    const purchaseOrder = await this.findOne(purchaseOrderId);

    if (purchaseOrder.status !== 'draft') {
      throw new BadRequestException(
        `Cannot remove items from purchase order in ${purchaseOrder.status} status`
      );
    }

    const item = await this.prisma.purchase_order_items.findUnique({
      where: { id: itemId },
    });

    if (!item || item.purchase_order_id !== purchaseOrderId) {
      throw new NotFoundException(`Purchase Order Item with ID ${itemId} not found`);
    }

    await this.prisma.purchase_order_items.delete({
      where: { id: itemId },
    });

    return { message: 'Item removed successfully' };
  }

  /**
   * Submit a purchase order for approval
   */
  async submitForApproval(id: string, userId: string) {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status !== 'draft') {
      throw new BadRequestException(
        `Cannot submit purchase order in ${purchaseOrder.status} status`
      );
    }

    if (purchaseOrder.purchase_order_items.length === 0) {
      throw new BadRequestException(
        'Cannot submit purchase order without items'
      );
    }

    return this.prisma.purchase_orders.update({
      where: { id },
      data: {
        status: 'pending_approval',
        submitted_at: new Date(),
        submitted_by: userId,
        updated_by_id: userId,
      },
      include: {
        suppliers: true,
        purchase_order_items: true,
      },
    });
  }

  /**
   * Approve a purchase order and update stock
   */
  async approve(id: string, userId: string) {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot approve purchase order in ${purchaseOrder.status} status`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update purchase order status
      const approved = await tx.purchase_orders.update({
        where: { id },
        data: {
          status: 'approved',
          approved_at: new Date(),
          approved_by: userId,
          stock_updated: true,
          stock_updated_at: new Date(),
          updated_by_id: userId,
        },
        include: {
          suppliers: true,
          purchase_order_items: true,
        },
      });

      // Update stock for each item
      for (const item of purchaseOrder.purchase_order_items) {
        if (item.product_id) {
          // Update product stock via inventory_transactions
          await tx.inventory_transactions.create({
            data: {
              location_id: await this.getDefaultLocationId(tx),
              product_id: item.product_id,
              transaction_type: 'purchase',
              quantity: item.quantity_ordered,
              unit_cost: item.unit_cost,
              total_cost: item.total_cost,
              reference_type: 'purchase_order',
              reference_id: id,
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
                  increment: item.quantity_ordered,
                },
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                location_id: defaultLocationId,
                product_id: item.product_id,
                quantity_on_hand: item.quantity_ordered,
              },
            });
          }
        } else if (item.product_variant_id) {
          // Update variant stock
          await tx.inventory_transactions.create({
            data: {
              location_id: await this.getDefaultLocationId(tx),
              product_variant_id: item.product_variant_id,
              transaction_type: 'purchase',
              quantity: item.quantity_ordered,
              unit_cost: item.unit_cost,
              total_cost: item.total_cost,
              reference_type: 'purchase_order',
              reference_id: id,
              created_by: userId,
            },
          });

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
                  increment: item.quantity_ordered,
                },
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                location_id: defaultLocationId,
                product_variant_id: item.product_variant_id,
                quantity_on_hand: item.quantity_ordered,
              },
            });
          }
        }
      }

      return approved;
    });
  }

  /**
   * Reject a purchase order
   */
  async reject(id: string, userId: string, reason?: string) {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot reject purchase order in ${purchaseOrder.status} status`
      );
    }

    return this.prisma.purchase_orders.update({
      where: { id },
      data: {
        status: 'rejected',
        rejected_at: new Date(),
        rejected_by: userId,
        rejection_reason: reason,
        updated_by_id: userId,
      },
      include: {
        suppliers: true,
        purchase_order_items: true,
      },
    });
  }

  /**
   * Cancel a draft purchase order
   */
  async cancel(id: string, userId: string) {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status !== 'draft') {
      throw new BadRequestException(
        `Cannot cancel purchase order in ${purchaseOrder.status} status. Only draft orders can be cancelled.`
      );
    }

    return this.prisma.purchase_orders.update({
      where: { id },
      data: {
        status: 'cancelled',
        updated_by_id: userId,
      },
      include: {
        suppliers: true,
        purchase_order_items: true,
      },
    });
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
   * Remove (delete) a purchase order (only draft status)
   */
  async remove(id: string, userId: string) {
    const purchaseOrder = await this.findOne(id);

    if (purchaseOrder.status !== 'draft') {
      throw new BadRequestException(
        `Cannot delete purchase order in ${purchaseOrder.status} status. Only draft orders can be deleted.`
      );
    }

    await this.prisma.purchase_orders.delete({
      where: { id },
    });

    return { message: 'Purchase order deleted successfully' };
  }
}
