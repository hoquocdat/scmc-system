import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSalesOrderDto,
  OrderStatus,
  PaymentStatus,
} from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { Prisma } from '@prisma/client';
import { UserContextService } from '../auth/user-context.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PriceResolverService } from './pricing/price-resolver';
import { spendCreditForPayment } from '../sales-returns/customer-credit';
import { SalesPostingService } from './sales-posting.service';
import { CashBookPostingService } from '../cash-book/cash-book-posting.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private userContext: UserContextService,
    private loyaltyService: LoyaltyService,
    private posting: SalesPostingService,
    private cashBook: CashBookPostingService,
  ) {}

  /**
   * Creates a sales order. Prices and totals are computed on the server
   * (SalesPostingService); client-sent unit prices and totals are ignored.
   * Drafts do not move stock; confirmed/completed orders are fully posted.
   */
  async create(createSalesOrderDto: CreateSalesOrderDto) {
    try {
      const userId =
        createSalesOrderDto.created_by || this.userContext.getUserId() || undefined;
      const draft = this.posting.fromDto(createSalesOrderDto, userId);
      return await this.posting.createOrder(draft);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create sales order: ${error.message}`,
      );
    }
  }

  async findAll(query: SalesOrderQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
      from_date,
      to_date,
      ...filters
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.sales_ordersWhereInput = {};

    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: 'insensitive' } },
        { customer_name: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters.customer_id) where.customer_id = filters.customer_id;
    if (filters.store_id) where.store_id = filters.store_id;
    if (filters.created_by) where.created_by = filters.created_by;
    if (filters.processed_by) where.processed_by = filters.processed_by;
    if (filters.status) where.status = filters.status;
    if (filters.payment_status) where.payment_status = filters.payment_status;
    if (filters.channel) where.channel = filters.channel;

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at.gte = new Date(from_date);
      if (to_date) where.created_at.lte = new Date(to_date);
    }

    const [orders, total] = await Promise.all([
      this.prisma.sales_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          customers: true,
          stores: true,
          user_profiles_sales_orders_created_byTouser_profiles: true,
          user_profiles_sales_orders_processed_byTouser_profiles: true,
          sales_order_items: {
            include: {
              products: true,
              product_variants: true,
            },
          },
          sales_order_payments: true,
        },
      }),
      this.prisma.sales_orders.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.sales_orders.findUnique({
      where: { id },
      include: {
        customers: true,
        stores: true,
        user_profiles_sales_orders_created_byTouser_profiles: true,
        user_profiles_sales_orders_processed_byTouser_profiles: true,
        sales_order_items: {
          include: {
            products: true,
            product_variants: true,
          },
        },
        sales_order_payments: {
          include: {
            user_profiles: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales order with ID "${id}" not found`);
    }

    return order;
  }

  async update(id: string, updateSalesOrderDto: UpdateSalesOrderDto) {
    try {
      await this.findOne(id);

      const data: Prisma.sales_ordersUpdateInput = {
        ...updateSalesOrderDto,
        subtotal: updateSalesOrderDto.subtotal
          ? new Prisma.Decimal(updateSalesOrderDto.subtotal)
          : undefined,
        discount_amount: updateSalesOrderDto.discount_amount
          ? new Prisma.Decimal(updateSalesOrderDto.discount_amount)
          : undefined,
        tax_amount: updateSalesOrderDto.tax_amount
          ? new Prisma.Decimal(updateSalesOrderDto.tax_amount)
          : undefined,
        shipping_cost: updateSalesOrderDto.shipping_cost
          ? new Prisma.Decimal(updateSalesOrderDto.shipping_cost)
          : undefined,
        total_amount: updateSalesOrderDto.total_amount
          ? new Prisma.Decimal(updateSalesOrderDto.total_amount)
          : undefined,
      };

      if (updateSalesOrderDto.customer_id) {
        data.customers = { connect: { id: updateSalesOrderDto.customer_id } };
      }

      // Store update is handled via store_id field directly

      if (updateSalesOrderDto.created_by) {
        data.user_profiles_sales_orders_created_byTouser_profiles = {
          connect: { id: updateSalesOrderDto.created_by },
        };
      }

      const updatedOrder = await this.prisma.sales_orders.update({
        where: { id },
        data,
        include: {
          customers: true,
          stores: true,
          user_profiles_sales_orders_created_byTouser_profiles: true,
          user_profiles_sales_orders_processed_byTouser_profiles: true,
          sales_order_items: {
            include: {
              products: true,
              product_variants: true,
            },
          },
          sales_order_payments: true,
        },
      });

      return updatedOrder;
    } catch (error) {
      throw new BadRequestException(
        `Failed to update sales order: ${error.message}`,
      );
    }
  }

  async cancel(id: string) {
    try {
      const order = await this.findOne(id);

      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Order is already cancelled');
      }

      if (order.status === OrderStatus.COMPLETED) {
        throw new ConflictException('Cannot cancel a completed order');
      }

      // Get warehouse ID from store for inventory transactions
      const warehouseId = order.stores?.default_warehouse_id;

      // Cancel the order and create RETURN inventory transactions
      const cancelledOrder = await this.prisma.$transaction(async (tx) => {
        // Update order status
        const updated = await tx.sales_orders.update({
          where: { id },
          data: {
            status: OrderStatus.CANCELLED,
          },
          include: {
            sales_order_items: {
              include: {
                products: true,
                product_variants: true,
              },
            },
          },
        });

        // Return stock only if it was deducted (drafts never move stock)
        const wasPosted =
          (await tx.inventory_transactions.count({
            where: {
              reference_type: 'sales_order',
              reference_id: order.id,
              transaction_type: 'SALE',
            },
          })) > 0;
        if (warehouseId && wasPosted) {
          for (const item of updated.sales_order_items) {
            await tx.inventory_transactions.create({
              data: {
                transaction_type: 'RETURN',
                quantity: Math.abs(item.quantity),
                reference_id: order.id,
                reference_type: 'sales_order_cancellation',
                stock_locations: { connect: { id: warehouseId } },
                products: { connect: { id: item.product_id! } },
                product_variants: item.product_variant_id
                  ? { connect: { id: item.product_variant_id } }
                  : undefined,
              },
            });
          }
        }

        return updated;
      });

      // Reverse loyalty points if customer exists and order had points transactions
      if (order.customer_id) {
        try {
          await this.loyaltyService.reversePoints(
            order.customer_id,
            order.id,
            'sales_order',
          );
        } catch (loyaltyError) {
          // Log but don't fail the cancellation if loyalty reversal fails
          console.error('Failed to reverse loyalty points:', loyaltyError);
        }
      }

      return cancelledOrder;
    } catch (error) {
      throw new BadRequestException(
        `Failed to cancel sales order: ${error.message}`,
      );
    }
  }

  /**
   * Records a payment. Payment status, the customer's receivable and loyalty
   * earning are updated in the same transaction (SalesPostingService.settleIn).
   */
  async addPayment(createPaymentDto: CreatePaymentDto) {
    try {
      const order = await this.findOne(createPaymentDto.sales_order_id);

      if (!(createPaymentDto.amount > 0)) {
        throw new BadRequestException('Payment amount must be greater than 0');
      }
      const totalPaid = order.sales_order_payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const totalAmount = Number(order.total_amount);
      if (totalPaid + createPaymentDto.amount > totalAmount + 0.5) {
        throw new BadRequestException('Payment amount exceeds order total');
      }

      const receivedBy =
        createPaymentDto.received_by || this.userContext.getUserId() || undefined;

      return await this.prisma.$transaction(async (tx) => {
        const payment = await tx.sales_order_payments.create({
          data: {
            sales_orders: { connect: { id: createPaymentDto.sales_order_id } },
            payment_method: createPaymentDto.payment_method,
            amount: new Prisma.Decimal(createPaymentDto.amount),
            transaction_id: createPaymentDto.transaction_id,
            authorization_code: createPaymentDto.authorization_code,
            amount_tendered: createPaymentDto.amount_tendered
              ? new Prisma.Decimal(createPaymentDto.amount_tendered)
              : undefined,
            change_given: createPaymentDto.change_given
              ? new Prisma.Decimal(createPaymentDto.change_given)
              : undefined,
            notes: createPaymentDto.notes,
            status: 'completed',
            user_profiles: receivedBy
              ? { connect: { id: receivedBy } }
              : undefined,
          },
          include: {
            sales_orders: true,
            user_profiles: true,
          },
        });

        if (createPaymentDto.payment_method === 'store_credit')
          await spendCreditForPayment(tx, {
            customerId: order.customer_id,
            paymentId: payment.id,
            amount: createPaymentDto.amount,
            orderNumber: order.order_number,
            createdBy: receivedBy,
          });
        await this.cashBook.postSalesOrderPayment(tx, {
          orderId: order.id,
          paymentId: payment.id,
          method: createPaymentDto.payment_method,
          amount: createPaymentDto.amount,
          categoryCode: 'sale',
          createdBy: receivedBy,
        });
        await this.posting.settleIn(tx, order.id, receivedBy);
        return payment;
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(`Failed to add payment: ${error.message}`);
    }
  }

  // Status transition validation
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): boolean {
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.DRAFT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [], // Terminal state - no transitions allowed
      [OrderStatus.CANCELLED]: [], // Terminal state - no transitions allowed
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Confirms a draft: stock is deducted exactly once (with row locks), loyalty
   * points are redeemed and a receivable is created only for an unpaid balance.
   */
  async confirm(id: string, userId?: string) {
    try {
      const order = await this.findOne(id);

      if (order.status !== OrderStatus.DRAFT) {
        throw new ConflictException('Only draft orders can be confirmed');
      }
      const actor = userId || this.userContext.getUserId() || undefined;

      return await this.prisma.$transaction(async (tx) => {
        await tx.sales_orders.update({
          where: { id },
          data: { status: OrderStatus.CONFIRMED, processed_by: actor },
        });
        await this.posting.postConfirmedIn(tx, id, { userId: actor });
        await this.posting.settleIn(tx, id, actor);
        return tx.sales_orders.findUniqueOrThrow({
          where: { id },
          include: {
            sales_order_items: {
              include: { products: true, product_variants: true },
            },
            customers: true,
            stores: true,
            sales_order_payments: true,
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to confirm sales order: ${error.message}`,
      );
    }
  }

  async updateStatus(id: string, newStatus: OrderStatus, userId?: string) {
    try {
      const order = await this.findOne(id);

      if (!this.validateStatusTransition(order.status!, newStatus)) {
        throw new ConflictException(
          `Cannot transition from ${order.status} to ${newStatus}`,
        );
      }

      // Special handling for completing orders
      if (newStatus === OrderStatus.COMPLETED) {
        if (order.payment_status !== PaymentStatus.PAID) {
          throw new ConflictException(
            'Order must be fully paid before completing',
          );
        }
      }

      const updatedOrder = await this.prisma.sales_orders.update({
        where: { id },
        data: {
          status: newStatus,
          processed_by: userId,
          ...(newStatus === OrderStatus.COMPLETED && {
            delivered_date: new Date(),
          }),
        },
        include: {
          customers: true,
          stores: true,
          user_profiles_sales_orders_created_byTouser_profiles: true,
          user_profiles_sales_orders_processed_byTouser_profiles: true,
          sales_order_items: {
            include: {
              products: true,
              product_variants: true,
            },
          },
          sales_order_payments: true,
        },
      });

      return updatedOrder;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update order status: ${error.message}`,
      );
    }
  }

  async getStatistics(query: {
    from_date?: string;
    to_date?: string;
    created_by?: string;
    channel?: string;
  }) {
    const where: Prisma.sales_ordersWhereInput = {
      status: { not: OrderStatus.CANCELLED },
    };

    if (query.from_date || query.to_date) {
      where.created_at = {};
      if (query.from_date) where.created_at.gte = new Date(query.from_date);
      if (query.to_date) where.created_at.lte = new Date(query.to_date);
    }

    if (query.created_by) where.created_by = query.created_by;
    if (query.channel) where.channel = query.channel;

    const [totalOrders, completedOrders, revenue, discounts] =
      await Promise.all([
        this.prisma.sales_orders.count({ where }),
        this.prisma.sales_orders.count({
          where: { ...where, status: OrderStatus.COMPLETED },
        }),
        this.prisma.sales_orders.aggregate({
          where: {
            ...where,
            status: { in: [OrderStatus.COMPLETED, OrderStatus.READY] },
          },
          _sum: { total_amount: true },
        }),
        this.prisma.sales_orders.aggregate({
          where: {
            ...where,
            status: { in: [OrderStatus.COMPLETED, OrderStatus.READY] },
          },
          _sum: { discount_amount: true },
        }),
      ]);

    return {
      totalOrders,
      completedOrders,
      totalRevenue: Number(revenue._sum.total_amount || 0),
      totalDiscounts: Number(discounts._sum.discount_amount || 0),
    };
  }

  async getReportByEmployee(query: {
    from_date?: string;
    to_date?: string;
    employee_id?: string;
  }) {
    const where: Prisma.sales_ordersWhereInput = {
      status: { in: [OrderStatus.COMPLETED, OrderStatus.READY] },
    };

    if (query.from_date || query.to_date) {
      where.created_at = {};
      if (query.from_date) where.created_at.gte = new Date(query.from_date);
      if (query.to_date) where.created_at.lte = new Date(query.to_date);
    }

    // Filter by specific employee
    if (query.employee_id) {
      where.created_by = query.employee_id;
    }

    const orders = await this.prisma.sales_orders.findMany({
      where,
      include: {
        user_profiles_sales_orders_created_byTouser_profiles: true,
      },
    });

    // Group by employee
    const byEmployee: Record<
      string,
      {
        employee_id: string;
        employee_name: string;
        order_count: number;
        total_revenue: number;
        total_discount: number;
      }
    > = {};

    for (const order of orders) {
      const employeeId = order.created_by || 'unknown';
      const employeeName =
        order.user_profiles_sales_orders_created_byTouser_profiles?.full_name ||
        'Unknown';

      if (!byEmployee[employeeId]) {
        byEmployee[employeeId] = {
          employee_id: employeeId,
          employee_name: employeeName,
          order_count: 0,
          total_revenue: 0,
          total_discount: 0,
        };
      }

      byEmployee[employeeId].order_count++;
      byEmployee[employeeId].total_revenue += Number(order.total_amount || 0);
      byEmployee[employeeId].total_discount += Number(
        order.discount_amount || 0,
      );
    }

    return Object.values(byEmployee).sort(
      (a, b) => b.total_revenue - a.total_revenue,
    );
  }

  async getSalesEmployees() {
    // Get all active employees except technicians
    const employees = await this.prisma.user_profiles.findMany({
      where: {
        is_active: true,
        role: { not: 'technician' },
      },
      select: {
        id: true,
        full_name: true,
      },
      orderBy: {
        full_name: 'asc',
      },
    });

    return employees.map((e) => ({
      id: e.id,
      name: e.full_name,
    }));
  }

  async getReportByChannel(query: {
    from_date?: string;
    to_date?: string;
    employee_id?: string;
  }) {
    const where: Prisma.sales_ordersWhereInput = {
      status: { in: [OrderStatus.COMPLETED, OrderStatus.READY] },
    };

    if (query.from_date || query.to_date) {
      where.created_at = {};
      if (query.from_date) where.created_at.gte = new Date(query.from_date);
      if (query.to_date) where.created_at.lte = new Date(query.to_date);
    }

    // Filter by specific employee
    if (query.employee_id) {
      where.created_by = query.employee_id;
    }

    const orders = await this.prisma.sales_orders.findMany({
      where,
    });

    // Group by channel
    const byChannel: Record<
      string,
      {
        channel: string;
        order_count: number;
        total_revenue: number;
        total_discount: number;
      }
    > = {};

    for (const order of orders) {
      const channel = order.channel;

      if (!byChannel[channel]) {
        byChannel[channel] = {
          channel,
          order_count: 0,
          total_revenue: 0,
          total_discount: 0,
        };
      }

      byChannel[channel].order_count++;
      byChannel[channel].total_revenue += Number(order.total_amount || 0);
      byChannel[channel].total_discount += Number(order.discount_amount || 0);
    }

    return Object.values(byChannel).sort(
      (a, b) => b.total_revenue - a.total_revenue,
    );
  }

  async addItem(orderId: string, addItemDto: AddOrderItemDto) {
    try {
      const order = await this.findOne(orderId) as any;

      // Can only add items to unpaid or partially paid orders
      if (order.payment_status === 'paid') {
        throw new ConflictException('Cannot add items to a fully paid order');
      }

      // Can only add items to draft, confirmed, or processing orders
      const allowedStatuses = ['draft', 'confirmed', 'processing'];
      if (!allowedStatuses.includes(order.status)) {
        throw new ConflictException(
          'Cannot add items to orders with status: ' + order.status,
        );
      }

      // Get product info for the item
      const product = await this.prisma.products.findUnique({
        where: { id: addItemDto.product_id },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Check if the same product (and variant) already exists in the order
      const existingItem = order.sales_order_items?.find(
        (item: any) =>
          item.product_id === addItemDto.product_id &&
          item.product_variant_id === (addItemDto.product_variant_id || null),
      );

      // Create or update item and recalculate order totals in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        let resultItem;

        if (existingItem) {
          // Update existing item - increase quantity
          const newQuantity = existingItem.quantity + addItemDto.quantity;
          const itemTotal =
            (Number(existingItem.unit_price) -
              Number(existingItem.discount_amount || 0) +
              Number(existingItem.tax_amount || 0)) *
            newQuantity;

          resultItem = await tx.sales_order_items.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQuantity,
              total_amount: new Prisma.Decimal(itemTotal),
            },
            include: {
              products: true,
              product_variants: true,
            },
          });
        } else {
          // Create new item, priced by the server (price-books D4)
          const price = (
            await this.posting.prices.resolveMany(
              [addItemDto],
              {
                storeId: order.store_id,
                customerId: order.customer_id,
                priceBookId: order.price_book_id,
              },
              tx,
            )
          ).get(PriceResolverService.key(addItemDto))!;
          const itemTotal =
            (price.unitPrice -
              (addItemDto.discount_amount || 0) +
              (addItemDto.tax_amount || 0)) *
            addItemDto.quantity;

          resultItem = await tx.sales_order_items.create({
            data: {
              sales_orders: { connect: { id: orderId } },
              products: { connect: { id: addItemDto.product_id } },
              product_variants: addItemDto.product_variant_id
                ? { connect: { id: addItemDto.product_variant_id } }
                : undefined,
              product_name: price.name,
              product_sku: price.sku,
              variant_name: price.variantId ? price.name : null,
              quantity: addItemDto.quantity,
              unit_price: new Prisma.Decimal(price.unitPrice),
              base_unit_price: new Prisma.Decimal(price.basePrice),
              unit_cost: new Prisma.Decimal(price.unitCost),
              price_source: price.source,
              price_books: price.priceBookId
                ? { connect: { id: price.priceBookId } }
                : undefined,
              discount_amount: addItemDto.discount_amount
                ? new Prisma.Decimal(addItemDto.discount_amount)
                : undefined,
              tax_amount: addItemDto.tax_amount
                ? new Prisma.Decimal(addItemDto.tax_amount)
                : undefined,
              total_amount: new Prisma.Decimal(itemTotal),
              notes: addItemDto.notes,
            },
            include: {
              products: true,
              product_variants: true,
            },
          });
        }

        // Recalculate order totals
        const allItems = await tx.sales_order_items.findMany({
          where: { sales_order_id: orderId },
        });

        const newSubtotal = allItems.reduce(
          (sum, item) => sum + Number(item.unit_price) * item.quantity,
          0,
        );

        const newTaxAmount = allItems.reduce(
          (sum, item) => sum + Number(item.tax_amount || 0) * item.quantity,
          0,
        );

        // Recalculate discount if percent-based
        let newDiscountAmount = Number(order.discount_amount);
        if (order.discount_type === 'percent' && order.discount_percent) {
          newDiscountAmount =
            (newSubtotal * Number(order.discount_percent)) / 100;
        }

        const newTotalAmount =
          newSubtotal -
          newDiscountAmount +
          newTaxAmount +
          Number(order.shipping_cost || 0);

        // Update order totals
        await tx.sales_orders.update({
          where: { id: orderId },
          data: {
            subtotal: new Prisma.Decimal(newSubtotal),
            tax_amount: new Prisma.Decimal(newTaxAmount),
            discount_amount: new Prisma.Decimal(newDiscountAmount),
            total_amount: new Prisma.Decimal(newTotalAmount),
          },
        });

        return resultItem;
      });

      // Update customer receivable if order is not draft
      if (order.customer_id && order.status !== 'draft') {
        await this.updateReceivableAmount(orderId);
      }

      return result;
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to add item to order: ${error.message}`,
      );
    }
  }

  async removeItem(orderId: string, itemId: string) {
    try {
      const order = (await this.findOne(orderId)) as any;

      // Can only remove items from unpaid or partially paid orders
      if (order.payment_status === 'paid') {
        throw new ConflictException(
          'Cannot remove items from a fully paid order',
        );
      }

      // Can only remove items from draft, confirmed, or processing orders
      const allowedStatuses = ['draft', 'confirmed', 'processing'];
      if (!allowedStatuses.includes(order.status)) {
        throw new ConflictException(
          'Cannot remove items from orders with status: ' + order.status,
        );
      }

      // Check item exists and belongs to this order
      const item = await this.prisma.sales_order_items.findFirst({
        where: { id: itemId, sales_order_id: orderId },
      });

      if (!item) {
        throw new NotFoundException('Item not found in this order');
      }

      // Cannot remove the last item
      const itemCount = order.sales_order_items?.length || 0;
      if (itemCount <= 1) {
        throw new ConflictException(
          'Cannot remove the last item. Cancel the order instead.',
        );
      }

      // Remove item and update order totals in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete the item
        await tx.sales_order_items.delete({
          where: { id: itemId },
        });

        // Recalculate order totals
        const remainingItems = await tx.sales_order_items.findMany({
          where: { sales_order_id: orderId },
        });

        const newSubtotal = remainingItems.reduce(
          (sum, i) => sum + Number(i.unit_price) * i.quantity,
          0,
        );

        const newTaxAmount = remainingItems.reduce(
          (sum, i) => sum + Number(i.tax_amount || 0) * i.quantity,
          0,
        );

        // Recalculate discount if percent-based
        let newDiscountAmount = Number(order.discount_amount);
        if (order.discount_type === 'percent' && order.discount_percent) {
          newDiscountAmount =
            (newSubtotal * Number(order.discount_percent)) / 100;
        }

        const newTotalAmount =
          newSubtotal -
          newDiscountAmount +
          newTaxAmount +
          Number(order.shipping_cost || 0);

        // Update order totals
        await tx.sales_orders.update({
          where: { id: orderId },
          data: {
            subtotal: new Prisma.Decimal(newSubtotal),
            tax_amount: new Prisma.Decimal(newTaxAmount),
            discount_amount: new Prisma.Decimal(newDiscountAmount),
            total_amount: new Prisma.Decimal(newTotalAmount),
          },
        });
      });

      // Update customer receivable if order is not draft
      if (order.customer_id && order.status !== 'draft') {
        await this.updateReceivableAmount(orderId);
      }

      return { success: true, message: 'Item removed successfully' };
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to remove item from order: ${error.message}`,
      );
    }
  }

  // Helper method to update receivable amount when order total changes
  private async updateReceivableAmount(orderId: string) {
    try {
      const order = await this.prisma.sales_orders.findUnique({
        where: { id: orderId },
      });

      if (!order) return;

      const receivable = await (this.prisma as any).customer_receivables.findFirst({
        where: { sales_order_id: orderId },
      });

      if (receivable) {
        const newBalance =
          Number(order.total_amount) - Number(receivable.paid_amount);
        await (this.prisma as any).customer_receivables.update({
          where: { id: receivable.id },
          data: {
            original_amount: order.total_amount,
            balance: new Prisma.Decimal(newBalance),
            status:
              newBalance <= 0
                ? 'paid'
                : Number(receivable.paid_amount) > 0
                  ? 'partial'
                  : 'unpaid',
          },
        });
      }
    } catch {
      // Silently ignore errors in receivable updates
    }
  }
}
