import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierPaymentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a unique payment number
   */
  private async generatePaymentNumber(): Promise<string> {
    const prefix = 'SP';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Find the last payment number for this month
    const lastPayment = await this.prisma.supplier_payments.findFirst({
      where: {
        payment_number: {
          startsWith: `${prefix}${year}${month}`,
        },
      },
      orderBy: {
        payment_number: 'desc',
      },
    });

    let sequence = 1;
    if (lastPayment) {
      const lastSequence = parseInt(lastPayment.payment_number.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a supplier payment with automatic or manual allocation
   */
  async create(dto: CreateSupplierPaymentDto, userId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: dto.supplier_id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${dto.supplier_id} not found`);
    }

    // Calculate supplier's outstanding balance
    const outstandingBalance = await this.getSupplierOutstandingBalance(dto.supplier_id);

    // Validate payment amount doesn't exceed outstanding balance
    if (dto.amount > outstandingBalance) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding balance (${outstandingBalance})`
      );
    }

    const paymentNumber = await this.generatePaymentNumber();

    return this.prisma.$transaction(async (tx) => {
      // Create the payment
      const payment = await tx.supplier_payments.create({
        data: {
          payment_number: paymentNumber,
          supplier_id: dto.supplier_id,
          amount: new Prisma.Decimal(dto.amount),
          payment_method: dto.payment_method as any,
          payment_date: dto.payment_date ? new Date(dto.payment_date) : new Date(),
          transaction_id: dto.transaction_id,
          reference_number: dto.reference_number,
          notes: dto.notes,
          created_by_id: userId,
        },
        include: {
          suppliers: true,
        },
      });

      let allocations;

      // Handle allocations
      if (dto.allocations && dto.allocations.length > 0) {
        // Manual allocation
        allocations = await this.allocatePaymentManually(
          payment.id,
          dto.allocations,
          tx
        );
      } else {
        // Automatic allocation to oldest unpaid POs
        allocations = await this.allocatePaymentAutomatically(
          payment.id,
          dto.supplier_id,
          dto.amount,
          tx
        );
      }

      return {
        ...payment,
        supplier_payment_allocations: allocations,
      };
    });
  }

  /**
   * Allocate payment manually to specific purchase orders
   */
  private async allocatePaymentManually(
    paymentId: string,
    allocations: Array<{ purchase_order_id: string; amount_allocated: number }>,
    tx: Prisma.TransactionClient
  ) {
    const results = [];

    // Validate total allocated amount doesn't exceed payment amount
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount_allocated, 0);
    const payment = await tx.supplier_payments.findUnique({
      where: { id: paymentId },
    });

    if (totalAllocated > Number(payment.amount)) {
      throw new BadRequestException(
        `Total allocated amount (${totalAllocated}) exceeds payment amount (${payment.amount})`
      );
    }

    for (const allocation of allocations) {
      // Verify purchase order exists and belongs to the same supplier
      const purchaseOrder = await tx.purchase_orders.findUnique({
        where: { id: allocation.purchase_order_id },
      });

      if (!purchaseOrder) {
        throw new NotFoundException(
          `Purchase Order with ID ${allocation.purchase_order_id} not found`
        );
      }

      if (purchaseOrder.supplier_id !== payment.supplier_id) {
        throw new BadRequestException(
          `Purchase Order ${allocation.purchase_order_id} does not belong to supplier ${payment.supplier_id}`
        );
      }

      // Check if allocation amount doesn't exceed remaining balance
      const remainingBalance = Number(purchaseOrder.total_amount) - Number(purchaseOrder.paid_amount);
      if (allocation.amount_allocated > remainingBalance) {
        throw new BadRequestException(
          `Allocation amount (${allocation.amount_allocated}) exceeds remaining balance (${remainingBalance}) for PO ${purchaseOrder.order_number}`
        );
      }

      // Create allocation
      const allocationRecord = await tx.supplier_payment_allocations.create({
        data: {
          supplier_payment_id: paymentId,
          purchase_order_id: allocation.purchase_order_id,
          amount_allocated: new Prisma.Decimal(allocation.amount_allocated),
        },
        include: {
          purchase_orders: true,
        },
      });

      results.push(allocationRecord);
    }

    return results;
  }

  /**
   * Allocate payment automatically to oldest unpaid purchase orders
   */
  private async allocatePaymentAutomatically(
    paymentId: string,
    supplierId: string,
    paymentAmount: number,
    tx: Prisma.TransactionClient
  ) {
    const results = [];

    // Get all approved POs with unpaid balance, ordered by date (oldest first)
    const unpaidPOs = await tx.purchase_orders.findMany({
      where: {
        supplier_id: supplierId,
        status: 'approved',
        payment_status: {
          in: ['unpaid', 'partially_paid'],
        },
      },
      orderBy: [
        { order_date: 'asc' },
        { created_at: 'asc' },
      ],
    });

    let remainingAmount = paymentAmount;

    for (const po of unpaidPOs) {
      if (remainingAmount <= 0) break;

      const poBalance = Number(po.total_amount) - Number(po.paid_amount);
      const allocationAmount = Math.min(remainingAmount, poBalance);

      // Create allocation
      const allocation = await tx.supplier_payment_allocations.create({
        data: {
          supplier_payment_id: paymentId,
          purchase_order_id: po.id,
          amount_allocated: new Prisma.Decimal(allocationAmount),
        },
        include: {
          purchase_orders: true,
        },
      });

      results.push(allocation);
      remainingAmount -= allocationAmount;
    }

    return results;
  }

  /**
   * Get supplier's outstanding balance
   */
  private async getSupplierOutstandingBalance(supplierId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ balance_due: number }>>`
      SELECT * FROM get_supplier_accounts_payable(${supplierId}::uuid)
    `;

    if (result && result.length > 0) {
      return Number(result[0].balance_due);
    }

    return 0;
  }

  /**
   * Find all payments for a supplier
   */
  async findBySupplier(supplierId: string) {
    return this.prisma.supplier_payments.findMany({
      where: {
        supplier_id: supplierId,
      },
      include: {
        suppliers: true,
        supplier_payment_allocations: {
          include: {
            purchase_orders: true,
          },
        },
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        payment_date: 'desc',
      },
    });
  }

  /**
   * Find one payment by ID
   */
  async findOne(id: string) {
    const payment = await this.prisma.supplier_payments.findUnique({
      where: { id },
      include: {
        suppliers: true,
        supplier_payment_allocations: {
          include: {
            purchase_orders: true,
          },
        },
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Supplier Payment with ID ${id} not found`);
    }

    return payment;
  }

  /**
   * Get all payments (with optional filtering)
   */
  async findAll(supplierId?: string, startDate?: string, endDate?: string) {
    const where: Prisma.supplier_paymentsWhereInput = {};

    if (supplierId) {
      where.supplier_id = supplierId;
    }

    if (startDate || endDate) {
      where.payment_date = {};
      if (startDate) {
        where.payment_date.gte = new Date(startDate);
      }
      if (endDate) {
        where.payment_date.lte = new Date(endDate);
      }
    }

    return this.prisma.supplier_payments.findMany({
      where,
      include: {
        suppliers: true,
        supplier_payment_allocations: {
          include: {
            purchase_orders: true,
          },
        },
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        payment_date: 'desc',
      },
    });
  }
}
