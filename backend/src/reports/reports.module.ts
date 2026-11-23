import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportService } from './export.service';
import { FinancialReportsService } from './financial-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ReportExportInterceptor } from './report-export.interceptor';
import { ReportsController } from './reports.controller';
import { SalesReportsService } from './sales-reports.service';
import { WorkshopReportsService } from './workshop-reports.service';

@Module({
  imports: [PrismaModule, CaslModule, ActivityLogsModule],
  controllers: [ReportsController],
  providers: [
    SalesReportsService,
    InventoryReportsService,
    FinancialReportsService,
    WorkshopReportsService,
    ExportService,
    ReportExportInterceptor,
  ],
  exports: [
    SalesReportsService,
    InventoryReportsService,
    FinancialReportsService,
    WorkshopReportsService,
    ExportService,
  ],
})
export class ReportsModule {}
