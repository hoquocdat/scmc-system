import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserContextService } from '../auth/user-context.service';
import { CashBookPostingService } from '../cash-book/cash-book-posting.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private userContext: UserContextService,
    private cashBook: CashBookPostingService,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.payments.findMany({
        include: {
          service_orders: {
            select: {
              order_number: true,
              bikes: {
                select: {
                  brand: true,
                  model: true,
                  license_plate: true,
                },
              },
            },
          },
        },
        orderBy: {
          payment_date: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.payments.count(),
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

  async findByServiceOrder(serviceOrderId: string) {
    return this.prisma.payments.findMany({
      where: { service_order_id: serviceOrderId },
      orderBy: {
        payment_date: 'desc',
      },
    });
  }

  async findOutstanding() {
    const orders = await this.prisma.service_orders.findMany({
      where: {
        status: {
          in: ['completed', 'ready_for_pickup'],
        },
      },
      include: {
        bikes: {
          select: {
            brand: true,
            model: true,
            license_plate: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: {
        actual_completion_date: 'desc',
      },
    });

    // Calculate outstanding balance for each order
    const ordersWithBalance = orders
      .map((order: any) => {
        const totalPaid =
          order.payments?.reduce(
            (sum: number, p: any) => sum + Number(p.amount),
            0,
          ) || 0;
        const totalCost = Number(order.final_cost || order.estimated_cost || 0);
        const balance = totalCost - totalPaid;

        return {
          ...order,
          total_paid: totalPaid,
          balance: balance,
        };
      })
      .filter((order: any) => order.balance > 0);

    return ordersWithBalance;
  }

  /**
   * Records a workshop payment and its cash book receipt in one transaction,
   * on the account mapped to the service order's branch (default branch when
   * the order has none) and the payment method.
   */
  async create(createPaymentDto: CreatePaymentDto, userId?: string) {
    const receivedBy = userId || this.userContext.getUserId() || null;
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.service_orders.findFirst({
        where: { id: createPaymentDto.service_order_id },
        select: {
          id: true,
          order_number: true,
          store_id: true,
          customer_id: true,
          customers: { select: { full_name: true } },
        },
      });
      if (!order) {
        throw new NotFoundException(
          `Service order ${createPaymentDto.service_order_id} not found`,
        );
      }
      const payment = await tx.payments.create({
        data: {
          service_order_id: createPaymentDto.service_order_id,
          amount: createPaymentDto.amount,
          payment_method: createPaymentDto.payment_method,
          is_deposit: createPaymentDto.is_deposit,
          payment_date: new Date(),
          received_by: receivedBy,
          notes: createPaymentDto.notes || null,
        },
      });
      await this.cashBook.post(tx, {
        storeId: order.store_id,
        method: createPaymentDto.payment_method,
        direction: 'in',
        amount: Number(createPaymentDto.amount),
        categoryCode: 'workshop_service',
        counterparty: {
          type: 'customer',
          id: order.customer_id,
          name: order.customers?.full_name ?? null,
        },
        source: { type: 'service_payment', id: payment.id },
        linkOpenShiftOf: receivedBy,
        isAutomatic: true,
        note: `${createPaymentDto.is_deposit ? 'Đặt cọc' : 'Thanh toán'} phiếu dịch vụ ${order.order_number}`,
        createdBy: receivedBy,
      });
      return payment;
    });
  }

  /** Deletes a workshop payment; its cash book receipt is reversed, never deleted. */
  async remove(id: string) {
    const actor = this.userContext.getUserId();
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findFirst({ where: { id } });
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found`);
      }
      await this.cashBook.reverse(
        tx,
        'service_payment',
        id,
        'Xóa thanh toán dịch vụ',
        actor,
      );
      await tx.payments.delete({ where: { id } });
      return { message: 'Payment deleted successfully' };
    });
  }
}
