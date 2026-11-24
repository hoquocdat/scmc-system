import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Payment methods that are not money and never reach the cash book (sales-returns D7, D9). */
export const NON_MONEY_METHODS: ReadonlySet<string> = new Set([
  'store_credit',
  'exchange',
]);

export class InsufficientCreditException extends UnprocessableEntityException {
  constructor(balance: number, requested: number) {
    super({
      code: 'INSUFFICIENT_CREDIT',
      message: `Số dư tiền trả hàng của khách là ${balance.toLocaleString('vi-VN')} đ, không đủ ${requested.toLocaleString('vi-VN')} đ`,
      balance,
    });
  }
}

/** Locks the customer row and returns its credit balance. */
async function lockBalance(tx: Tx, customerId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ credit_balance: Prisma.Decimal }[]>`
    SELECT credit_balance FROM customers WHERE id = ${customerId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException('Không tìm thấy khách hàng');
  return Number(rows[0].credit_balance);
}

/**
 * Adds (+) or uses (−) customer credit inside the caller's transaction and
 * records the movement with its source. Using more than the balance is refused.
 */
export async function moveCustomerCredit(
  tx: Tx,
  input: {
    customerId: string;
    amount: number;
    sourceType: 'sales_return' | 'sales_order_payment' | 'adjustment';
    sourceId?: string | null;
    note?: string | null;
    createdBy?: string | null;
  },
): Promise<number> {
  const balance = await lockBalance(tx, input.customerId);
  const next = balance + input.amount;
  if (input.amount < 0 && next < 0)
    throw new InsufficientCreditException(balance, -input.amount);
  await tx.customers.update({
    where: { id: input.customerId },
    data: { credit_balance: new Prisma.Decimal(next) },
  });
  await tx.customer_credit_transactions.create({
    data: {
      customer_id: input.customerId,
      amount: new Prisma.Decimal(input.amount),
      balance_after: new Prisma.Decimal(next),
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      note: input.note ?? null,
      created_by: input.createdBy ?? null,
    },
  });
  return next;
}

/** A `store_credit` payment on an order uses the customer's credit (D9). */
export async function spendCreditForPayment(
  tx: Tx,
  input: {
    customerId: string | null | undefined;
    paymentId: string;
    amount: number;
    orderNumber?: string | null;
    createdBy?: string | null;
  },
): Promise<void> {
  if (!input.customerId)
    throw new UnprocessableEntityException({
      code: 'PAYMENT_RULE',
      message: 'Thanh toán bằng tiền trả hàng cần chọn khách hàng',
    });
  await moveCustomerCredit(tx, {
    customerId: input.customerId,
    amount: -input.amount,
    sourceType: 'sales_order_payment',
    sourceId: input.paymentId,
    note: input.orderNumber ? `Thanh toán đơn ${input.orderNumber}` : null,
    createdBy: input.createdBy,
  });
}
