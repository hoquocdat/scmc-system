import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { CashBookCoreModule } from './cash-book-core.module';
import { CashBookController } from './cash-book.controller';
import { CashBookService } from './cash-book.service';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    ActivityLogsModule,
    ReportsModule,
    CashBookCoreModule,
  ],
  controllers: [CashBookController],
  providers: [CashBookService],
  exports: [CashBookService],
})
export class CashBookModule {}
