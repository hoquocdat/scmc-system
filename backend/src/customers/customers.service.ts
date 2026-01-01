import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RecordReceivablePaymentDto } from './dto/record-receivable-payment.dto';
import { UserContextService } from '../auth/user-context.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private userContext: UserContextService,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.customers.findMany({
        include: {
          salesperson: {
            select: {
              id: true,
              full_name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.customers.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customers.findUnique({
      where: { id },
      include: {
        salesperson: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async checkPhoneAvailability(phone: string) {
    const existingCustomer = await this.prisma.customers.findFirst({
      where: { phone },
      select: { id: true },
    });

    return {
      available: !existingCustomer,
      phone: phone,
    };
  }

  async create(createCustomerDto: CreateCustomerDto) {
    // Check if phone number already exists
    const existingCustomer = await this.prisma.customers.findFirst({
      where: { phone: createCustomerDto.phone },
      select: { id: true, phone: true },
    });

    if (existingCustomer) {
      throw new ConflictException('Số điện thoại này đã được sử dụng bởi khách hàng khác');
    }

    return this.prisma.customers.create({
      data: {
        full_name: createCustomerDto.full_name,
        phone: createCustomerDto.phone,
        email: createCustomerDto.email || null,
        address: createCustomerDto.address || null,
        notes: createCustomerDto.notes || null,
        id_number: createCustomerDto.id_number || null,
        facebook: createCustomerDto.facebook || null,
        instagram: createCustomerDto.instagram || null,
        birthday: createCustomerDto.birthday || null,
        salesperson_id: createCustomerDto.salesperson_id || null,
        created_by_id: this.userContext.getUserId(),
      },
      include: {
        salesperson: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    // First check if customer exists
    await this.findOne(id);

    // Check if phone number is being updated and if it's already used by another customer
    if (updateCustomerDto.phone !== undefined) {
      const existingCustomer = await this.prisma.customers.findFirst({
        where: {
          phone: updateCustomerDto.phone,
          NOT: {
            id: id,
          },
        },
        select: { id: true, phone: true },
      });

      if (existingCustomer) {
        throw new ConflictException('Số điện thoại này đã được sử dụng bởi khách hàng khác');
      }
    }

    return this.prisma.customers.update({
      where: { id },
      data: {
        ...updateCustomerDto,
        updated_at: new Date(),
        updated_by_id: this.userContext.getUserId(),
      },
      include: {
        salesperson: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    // First check if customer exists
    await this.findOne(id);

    await this.prisma.customers.delete({
      where: { id },
    });

    return { message: 'Customer deleted successfully' };
  }

  async getReceivables(id: string) {
    // First check if customer exists
    await this.findOne(id);

    const receivables = await this.prisma.customer_receivables.findMany({
      where: { customer_id: id },
      include: {
        sales_orders: {
          select: {
            id: true,
            order_number: true,
            total_amount: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Calculate totals
    const summary = receivables.reduce(
      (acc, r) => ({
        total_original: acc.total_original + Number(r.original_amount || 0),
        total_paid: acc.total_paid + Number(r.paid_amount || 0),
        total_balance: acc.total_balance + Number(r.balance || 0),
      }),
      { total_original: 0, total_paid: 0, total_balance: 0 },
    );

    return {
      receivables,
      summary,
    };
  }

  async getOrders(id: string, page: number = 1, limit: number = 10) {
    // First check if customer exists
    await this.findOne(id);

    const offset = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.sales_orders.findMany({
        where: { customer_id: id },
        include: {
          stores: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          sales_order_items: {
            select: {
              id: true,
              quantity: true,
              unit_price: true,
              total_amount: true,
              products: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.sales_orders.count({
        where: { customer_id: id },
      }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Record a payment against customer receivables
   * - If sales_order_id is provided, apply payment to that specific order
   * - Otherwise, apply payment using FIFO to oldest unpaid/partial orders
   */
  async recordReceivablePayment(dto: RecordReceivablePaymentDto) {
    // Verify customer exists
    await this.findOne(dto.customer_id);

    // Validate payment amount
    if (dto.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    // Get customer's total outstanding balance
    const receivablesSummary = await this.getReceivables(dto.customer_id);
    const totalBalance = receivablesSummary.summary.total_balance;

    if (totalBalance <= 0) {
      throw new BadRequestException('Khách hàng không có công nợ cần thanh toán');
    }

    if (dto.amount > totalBalance) {
      throw new BadRequestException(
        `Số tiền thanh toán (${dto.amount.toLocaleString()}) vượt quá tổng công nợ (${totalBalance.toLocaleString()})`,
      );
    }

    const userId = this.userContext.getUserId();
    let remainingAmount = dto.amount;
    const paymentResults: any[] = [];

    // Execute in transaction
    await this.prisma.$transaction(async (tx) => {
      // If specific order is provided, apply to that order only
      if (dto.sales_order_id) {
        const receivable = await tx.customer_receivables.findFirst({
          where: {
            customer_id: dto.customer_id,
            sales_order_id: dto.sales_order_id,
            status: { in: ['unpaid', 'partial'] },
          },
          include: {
            sales_orders: true,
          },
        });

        if (!receivable) {
          throw new BadRequestException(
            'Không tìm thấy công nợ cho đơn hàng này hoặc đơn hàng đã được thanh toán đầy đủ',
          );
        }

        const orderBalance = Number(receivable.balance);
        if (dto.amount > orderBalance) {
          throw new BadRequestException(
            `Số tiền thanh toán (${dto.amount.toLocaleString()}) vượt quá công nợ đơn hàng (${orderBalance.toLocaleString()})`,
          );
        }

        // Apply payment to this specific order
        await this.applyPaymentToReceivable(
          tx,
          receivable,
          dto.amount,
          dto.payment_method,
          dto.transaction_id,
          dto.notes,
          userId,
        );
        paymentResults.push({
          order_number: receivable.sales_orders.order_number,
          amount_applied: dto.amount,
        });
      } else {
        // FIFO: Apply payment to oldest unpaid/partial orders first
        const unpaidReceivables = await tx.customer_receivables.findMany({
          where: {
            customer_id: dto.customer_id,
            status: { in: ['unpaid', 'partial'] },
          },
          include: {
            sales_orders: true,
          },
          orderBy: { created_at: 'asc' }, // Oldest first (FIFO)
        });

        for (const receivable of unpaidReceivables) {
          if (remainingAmount <= 0) break;

          const orderBalance = Number(receivable.balance);
          const amountToApply = Math.min(remainingAmount, orderBalance);

          await this.applyPaymentToReceivable(
            tx,
            receivable,
            amountToApply,
            dto.payment_method,
            dto.transaction_id,
            dto.notes,
            userId,
          );

          paymentResults.push({
            order_number: receivable.sales_orders.order_number,
            amount_applied: amountToApply,
          });

          remainingAmount -= amountToApply;
        }
      }
    });

    // Return updated receivables
    const updatedReceivables = await this.getReceivables(dto.customer_id);

    return {
      success: true,
      message: `Đã ghi nhận thanh toán ${dto.amount.toLocaleString()} VND`,
      payment_details: paymentResults,
      updated_summary: updatedReceivables.summary,
    };
  }

  /**
   * Helper method to apply payment to a single receivable
   */
  private async applyPaymentToReceivable(
    tx: Prisma.TransactionClient,
    receivable: any,
    amount: number,
    paymentMethod: string,
    transactionId?: string,
    notes?: string,
    userId?: string,
  ) {
    const currentPaid = Number(receivable.paid_amount || 0);
    const newPaidAmount = currentPaid + amount;
    const originalAmount = Number(receivable.original_amount);
    const newBalance = originalAmount - newPaidAmount;

    // Determine new status
    let newStatus: string;
    if (newBalance <= 0) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'unpaid';
    }

    // Update receivable
    await tx.customer_receivables.update({
      where: { id: receivable.id },
      data: {
        paid_amount: new Prisma.Decimal(newPaidAmount),
        balance: new Prisma.Decimal(Math.max(0, newBalance)),
        status: newStatus,
        updated_at: new Date(),
      },
    });

    // Create payment record on the sales order
    await tx.sales_order_payments.create({
      data: {
        sales_orders: { connect: { id: receivable.sales_order_id } },
        payment_method: paymentMethod,
        amount: new Prisma.Decimal(amount),
        transaction_id: transactionId,
        notes: notes ? `[Công nợ] ${notes}` : '[Thanh toán công nợ]',
        user_profiles: userId ? { connect: { id: userId } } : undefined,
      },
    });

    // Update sales order payment status and paid_amount
    const order = await tx.sales_orders.findUnique({
      where: { id: receivable.sales_order_id },
    });

    if (order) {
      const orderPaidAmount = Number(order.paid_amount || 0) + amount;
      const orderTotal = Number(order.total_amount);

      let orderPaymentStatus: string;
      if (orderPaidAmount >= orderTotal) {
        orderPaymentStatus = 'paid';
      } else if (orderPaidAmount > 0) {
        orderPaymentStatus = 'partial';
      } else {
        orderPaymentStatus = 'unpaid';
      }

      await tx.sales_orders.update({
        where: { id: receivable.sales_order_id },
        data: {
          paid_amount: new Prisma.Decimal(orderPaidAmount),
          payment_status: orderPaymentStatus,
          payment_date: orderPaymentStatus === 'paid' ? new Date() : null,
        },
      });
    }
  }

  /**
   * Get payment history for a customer's receivables
   */
  async getReceivablePaymentHistory(customerId: string) {
    await this.findOne(customerId);

    // Get all payments from sales orders linked to this customer
    const payments = await this.prisma.sales_order_payments.findMany({
      where: {
        sales_orders: {
          customer_id: customerId,
        },
      },
      include: {
        sales_orders: {
          select: {
            id: true,
            order_number: true,
            total_amount: true,
          },
        },
        user_profiles: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return payments;
  }
}
