import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { ReportsModule } from '../reports/reports.module';
import { CodesService } from './codes.service';
import { CountsService } from './counts.service';
import { ReorderService } from './reorder.service';
import { StockOperationsController } from './stock-operations.controller';
import { TransfersService } from './transfers.service';
import { WriteOffsService } from './write-offs.service';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    ActivityLogsModule,
    PurchaseOrdersModule,
    ReportsModule,
  ],
  controllers: [StockOperationsController],
  providers: [
    TransfersService,
    CountsService,
    WriteOffsService,
    CodesService,
    ReorderService,
  ],
  exports: [CodesService],
})
export class StockOperationsModule {}
