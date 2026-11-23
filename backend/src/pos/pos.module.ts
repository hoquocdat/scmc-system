import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CashBookCoreModule } from '../cash-book/cash-book-core.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesModule } from '../sales/sales.module';
import { PosCheckoutService } from './pos-checkout.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [PrismaModule, CaslModule, ActivityLogsModule, SalesModule, CashBookCoreModule],
  controllers: [PosController],
  providers: [PosService, PosCheckoutService],
  exports: [PosService, PosCheckoutService],
})
export class PosModule {}
