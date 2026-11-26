import { ForbiddenException } from '@nestjs/common';
import { Action, CaslAbilityFactory } from '../../casl/casl-ability.factory';

/** Choosing a price book for a sale needs price_books:apply (design D3). */
export async function assertCanApplyPriceBook(
  casl: CaslAbilityFactory,
  userId: string | null | undefined,
): Promise<void> {
  const ability = userId ? await casl.createForUser(userId) : null;
  if (!ability?.can(Action.Apply, 'price_books')) {
    throw new ForbiddenException({
      code: 'PRICE_BOOK_FORBIDDEN',
      message: 'Bạn không có quyền chọn bảng giá',
    });
  }
}
