import { Module } from '@nestjs/common';
import { CashBookCoreModule } from '../cash-book/cash-book-core.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [CashBookCoreModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
