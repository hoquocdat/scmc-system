import { Module } from '@nestjs/common';
import { CashBookCoreModule } from '../cash-book/cash-book-core.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [CashBookCoreModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
