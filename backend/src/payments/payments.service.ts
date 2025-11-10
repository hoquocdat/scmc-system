import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

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
        const totalPaid = order.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
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

  async create(createPaymentDto: CreatePaymentDto, userId?: string) {
    return this.prisma.payments.create({
      data: {
        service_order_id: createPaymentDto.service_order_id,
        amount: createPaymentDto.amount,
        payment_method: createPaymentDto.payment_method,
        is_deposit: createPaymentDto.is_deposit,
        payment_date: new Date(),
        received_by: userId || null,
        notes: createPaymentDto.notes || null,
      },
    });
  }

  async remove(id: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    await this.prisma.payments.delete({
      where: { id },
    });

    return { message: 'Payment deleted successfully' };
  }
}
