import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

export interface SupplierAccountsPayable {
  supplier_id: string;
  total_purchases: number;
  total_returns: number;
  total_payments: number;
  balance_due: number;
}

export interface SupplierTransaction {
  id: string;
  transaction_type: 'purchase' | 'return' | 'payment';
  supplier_id: string;
  reference_number: string;
  amount: number;
  transaction_date: Date;
  notes: string | null;
  created_at: Date;
}

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto) {
    return this.prisma.suppliers.create({
      data: createSupplierDto,
    });
  }

  async findAll() {
    return this.prisma.suppliers.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        is_active: true,
      },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    try {
      return await this.prisma.suppliers.update({
        where: { id },
        data: updateSupplierDto,
      });
    } catch (error) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.suppliers.delete({
        where: { id },
      });
      return { message: 'Supplier deleted successfully' };
    } catch (error) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
  }

  /**
   * Get supplier accounts payable balance
   */
  async getAccountsPayable(supplierId: string): Promise<SupplierAccountsPayable> {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const result = await this.prisma.$queryRaw<SupplierAccountsPayable[]>`
      SELECT * FROM get_supplier_accounts_payable(${supplierId}::uuid)
    `;

    if (result && result.length > 0) {
      return {
        supplier_id: supplierId,
        total_purchases: Number(result[0].total_purchases) || 0,
        total_returns: Number(result[0].total_returns) || 0,
        total_payments: Number(result[0].total_payments) || 0,
        balance_due: Number(result[0].balance_due) || 0,
      };
    }

    return {
      supplier_id: supplierId,
      total_purchases: 0,
      total_returns: 0,
      total_payments: 0,
      balance_due: 0,
    };
  }

  /**
   * Get supplier transaction history (purchases, returns, payments)
   */
  async getTransactionHistory(supplierId: string): Promise<SupplierTransaction[]> {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const transactions = await this.prisma.$queryRaw<SupplierTransaction[]>`
      SELECT * FROM supplier_transactions
      WHERE supplier_id = ${supplierId}::uuid
      ORDER BY transaction_date DESC, created_at DESC
    `;

    return transactions.map(t => ({
      ...t,
      amount: Number(t.amount),
    }));
  }

  /**
   * Get supplier purchase history (approved purchase orders only)
   */
  async getPurchaseHistory(supplierId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const purchaseOrders = await this.prisma.purchase_orders.findMany({
      where: {
        supplier_id: supplierId,
        status: 'approved',
      },
      include: {
        purchase_order_items: {
          include: {
            products: true,
            product_variants: true,
          },
        },
        supplier_payment_allocations: {
          include: {
            supplier_payments: true,
          },
        },
      },
      orderBy: {
        order_date: 'desc',
      },
    });

    return purchaseOrders.map(po => ({
      ...po,
      total_amount: Number(po.total_amount),
      paid_amount: Number(po.paid_amount),
      balance_due: Number(po.total_amount) - Number(po.paid_amount),
    }));
  }

  /**
   * Get outstanding (unpaid/partially paid) purchase orders for a supplier
   */
  async getOutstandingPurchaseOrders(supplierId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const purchaseOrders = await this.prisma.purchase_orders.findMany({
      where: {
        supplier_id: supplierId,
        status: 'approved',
        payment_status: {
          in: ['unpaid', 'partially_paid'],
        },
      },
      include: {
        purchase_order_items: true,
        supplier_payment_allocations: {
          include: {
            supplier_payments: true,
          },
        },
      },
      orderBy: {
        order_date: 'asc', // Oldest first
      },
    });

    return purchaseOrders.map(po => ({
      id: po.id,
      order_number: po.order_number,
      order_date: po.order_date,
      total_amount: Number(po.total_amount),
      paid_amount: Number(po.paid_amount),
      balance_due: Number(po.total_amount) - Number(po.paid_amount),
      payment_status: po.payment_status,
      items_count: po.purchase_order_items.length,
      payments: po.supplier_payment_allocations.map(alloc => ({
        payment_id: alloc.supplier_payment_id,
        payment_number: alloc.supplier_payments.payment_number,
        payment_date: alloc.supplier_payments.payment_date,
        amount_allocated: Number(alloc.amount_allocated),
      })),
    }));
  }

  /**
   * Get supplier details with accounts payable info
   */
  async getSupplierDetails(id: string) {
    const supplier = await this.findOne(id);
    const accountsPayable = await this.getAccountsPayable(id);
    const outstandingPOs = await this.getOutstandingPurchaseOrders(id);

    return {
      ...supplier,
      accounts_payable: accountsPayable,
      outstanding_purchase_orders: outstandingPOs,
    };
  }
}
