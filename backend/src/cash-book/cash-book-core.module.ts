import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashBookAccountsService } from './cash-book-accounts.service';
import { CashBookPostingService } from './cash-book-posting.service';

/**
 * Posting and balance services with no controller dependencies, imported by
 * every module that moves money (sales, POS, customers, workshop payments,
 * supplier payments, payroll, stores) without creating import cycles.
 */
@Module({
  imports: [PrismaModule],
  providers: [CashBookPostingService, CashBookAccountsService],
  exports: [CashBookPostingService, CashBookAccountsService],
})
export class CashBookCoreModule {}
