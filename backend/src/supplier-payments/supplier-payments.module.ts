import { Module } from '@nestjs/common';
import { CashBookCoreModule } from '../cash-book/cash-book-core.module';
import { SupplierPaymentsService } from './supplier-payments.service';
import { SupplierPaymentsController } from './supplier-payments.controller';

@Module({
  imports: [CashBookCoreModule],
  controllers: [SupplierPaymentsController],
  providers: [SupplierPaymentsService],
  exports: [SupplierPaymentsService],
})
export class SupplierPaymentsModule {}
