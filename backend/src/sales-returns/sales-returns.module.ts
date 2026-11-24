import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CashBookCoreModule } from '../cash-book/cash-book-core.module';
import { CaslModule } from '../casl/casl.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { SalesReturnsController } from './sales-returns.controller';
import { SalesReturnsService } from './sales-returns.service';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    ActivityLogsModule,
    CashBookCoreModule,
    LoyaltyModule,
    SalesModule,
    ReportsModule,
  ],
  controllers: [SalesReturnsController],
  providers: [SalesReturnsService],
})
export class SalesReturnsModule {}
