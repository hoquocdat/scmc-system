import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

export const CashBookErrorCode = {
  CASH_ACCOUNT_NOT_CONFIGURED: 'CASH_ACCOUNT_NOT_CONFIGURED',
  AUTOMATIC_ENTRY: 'AUTOMATIC_ENTRY',
  CASH_BOOK_RULE: 'CASH_BOOK_RULE',
} as const;

/** No active account could be resolved for a branch and payment method (design D3). */
export class CashAccountNotConfiguredException extends UnprocessableEntityException {
  constructor(message: string) {
    super({ code: CashBookErrorCode.CASH_ACCOUNT_NOT_CONFIGURED, message });
  }
}

/** Automatic entries are corrected only by reversing their source (design D8). */
export class AutomaticEntryException extends ConflictException {
  constructor() {
    super({
      code: CashBookErrorCode.AUTOMATIC_ENTRY,
      message:
        'Phiếu tự động không thể hủy trực tiếp; hãy hủy/đảo chứng từ gốc.',
    });
  }
}

/** Any other cash book business rule. */
export class CashBookRuleException extends UnprocessableEntityException {
  constructor(message: string) {
    super({ code: CashBookErrorCode.CASH_BOOK_RULE, message });
  }
}
