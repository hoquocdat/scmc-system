import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export class QrNotPaidException extends UnprocessableEntityException {
  constructor(message: string) {
    super({ code: 'QR_NOT_PAID', message });
  }
}

/**
 * A QR payment line at checkout (design D4): the request is locked and must
 * be paid, for the same branch, method, amount and cart, and not yet used.
 */
export async function claimQrPayment(
  tx: Tx,
  input: {
    requestId: string;
    storeId: string;
    method: string;
    amount: number;
    clientRequestId?: string | null;
  },
): Promise<{
  providerRef: string | null;
  cashAccountId: string | null;
  provider: string;
}> {
  await tx.$queryRaw`SELECT id FROM qr_payment_requests WHERE id = ${input.requestId}::uuid FOR UPDATE`;
  const r = await tx.qr_payment_requests.findFirst({
    where: { id: input.requestId },
  });
  if (!r) throw new QrNotPaidException('Không tìm thấy yêu cầu thanh toán QR');
  if (r.status !== 'paid')
    throw new QrNotPaidException(
      `Thanh toán QR ${r.code} chưa được xác nhận (${r.status})`,
    );
  if (r.sales_order_payment_id)
    throw new ConflictException({
      code: 'QR_ALREADY_USED',
      message: `Thanh toán QR ${r.code} đã dùng cho đơn khác`,
    });
  if (r.store_id !== input.storeId)
    throw new QrNotPaidException('Thanh toán QR thuộc chi nhánh khác');
  if (r.method !== input.method)
    throw new QrNotPaidException('Phương thức không khớp với thanh toán QR');
  if (Math.round(Number(r.amount)) !== Math.round(input.amount))
    throw new QrNotPaidException(
      `Số tiền phải đúng ${Number(r.amount).toLocaleString('vi-VN')} đ`,
    );
  if (
    r.client_request_id &&
    input.clientRequestId &&
    r.client_request_id !== input.clientRequestId
  )
    throw new QrNotPaidException('Thanh toán QR thuộc giỏ hàng khác');
  const settings = await tx.qr_provider_settings.findFirst({
    where: { store_id: r.store_id, provider: r.provider },
    select: { cash_account_id: true },
  });
  return {
    providerRef: r.provider_ref ?? r.code,
    cashAccountId: settings?.cash_account_id ?? null,
    provider: r.provider,
  };
}

/** Links the request to the payment it paid for. */
export async function linkQrPayment(
  tx: Tx,
  requestId: string,
  orderId: string,
  paymentId: string,
) {
  await tx.qr_payment_requests.update({
    where: { id: requestId },
    data: {
      sales_order_id: orderId,
      sales_order_payment_id: paymentId,
      updated_at: new Date(),
    },
  });
}
