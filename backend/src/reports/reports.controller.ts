import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { isExport, ReportQueryDto } from './dto/report-query.dto';
import { FinancialReportsService } from './financial-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ReportExportInterceptor } from './report-export.interceptor';
import { ReportScope } from './report-scope';
import { SalesReportsService } from './sales-reports.service';
import { WorkshopReportsService } from './workshop-reports.service';

/**
 * Reporting API. Every endpoint takes the shared ReportQueryDto (from, to,
 * storeId, interval, ...) and is guarded by a `reports` permission:
 *   sales -> reports:sales, inventory -> reports:inventory,
 *   financial -> reports:financial, workshop -> reports:service.
 * Adding `format=xlsx|csv` downloads the same report as a file; that also
 * requires reports:export (ReportExportInterceptor).
 */
@ApiTags('reports')
@ApiBearerAuth()
@ApiProduces(
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
)
@UseGuards(JwtAuthGuard, PoliciesGuard)
@UseInterceptors(ReportExportInterceptor)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly sales: SalesReportsService,
    private readonly inventory: InventoryReportsService,
    private readonly financial: FinancialReportsService,
    private readonly workshop: WorkshopReportsService,
  ) {}

  // ==================== SALES REPORTS ====================

  @Get('sales/summary')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary:
      'Retail sales summary: orders, gross, discounts, net sales, tax, items, AOV',
  })
  salesSummary(@Query() q: ReportQueryDto) {
    return this.sales.summary(new ReportScope(q));
  }

  @Get('sales/by-category')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Retail sales by product category' })
  salesByCategory(@Query() q: ReportQueryDto) {
    return this.sales.byCategory(new ReportScope(q));
  }

  @Get('sales/by-payment-method')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary: 'Retail money received per payment method (completed payments)',
  })
  salesByPaymentMethod(@Query() q: ReportQueryDto) {
    return this.sales.byPaymentMethod(new ReportScope(q));
  }

  @Get('sales/top-products')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary:
      'Best-selling products and variants (sortBy=quantity|netSales, limit)',
  })
  topProducts(@Query() q: ReportQueryDto) {
    return this.sales.topProducts(
      new ReportScope(q),
      q.limit ?? 10,
      (q.sortBy as 'quantity' | 'netSales') ?? 'quantity',
    );
  }

  @Get('sales/trends')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary:
      'Orders and net sales per day, week or month, including empty periods',
  })
  salesTrends(@Query() q: ReportQueryDto) {
    return this.sales.trends(new ReportScope(q));
  }

  // ==================== INVENTORY REPORTS ====================

  @Get('inventory/valuation')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary: 'Stock on hand and value at cost per product and location',
  })
  inventoryValuation(@Query() q: ReportQueryDto) {
    return this.inventory.valuation(new ReportScope(q), q);
  }

  @Get('inventory/movement')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary:
      'Stock movements in the period (paged; filters: productId, locationId, type). Exports include every row.',
  })
  inventoryMovement(@Query() q: ReportQueryDto) {
    return this.inventory.movement(new ReportScope(q), {
      ...q,
      all: isExport(q),
    });
  }

  @Get('inventory/low-stock')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary: 'Products at or below their reorder point, per location',
  })
  lowStock(@Query() q: ReportQueryDto) {
    return this.inventory.lowStock(new ReportScope(q), q);
  }

  @Get('inventory/turnover')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary: 'Units sold, COGS, average stock and turnover ratio per product',
  })
  inventoryTurnover(@Query() q: ReportQueryDto) {
    return this.inventory.turnover(new ReportScope(q));
  }

  // ==================== FINANCIAL REPORTS ====================

  @Get('financial/revenue')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({
    summary: 'Revenue and money received: retail, workshop and combined',
  })
  revenue(@Query() q: ReportQueryDto) {
    return this.financial.revenue(new ReportScope(q));
  }

  @Get('financial/profit')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({
    summary: 'Gross profit: net sales minus cost of goods sold at time of sale',
  })
  profit(@Query() q: ReportQueryDto) {
    return this.financial.profit(new ReportScope(q));
  }

  @Get('financial/vat')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({ summary: 'VAT from recorded tax amounts, per period' })
  vat(@Query() q: ReportQueryDto) {
    return this.financial.vat(new ReportScope(q));
  }

  // ==================== WORKSHOP REPORTS ====================

  @Get('workshop/revenue')
  @CheckPolicies({ action: Action.Service, subject: 'reports' })
  @ApiOperation({
    summary:
      'Service revenue from delivered orders, by delivery date, with trend',
  })
  workshopRevenue(@Query() q: ReportQueryDto) {
    return this.workshop.revenue(new ReportScope(q));
  }

  @Get('workshop/technicians')
  @CheckPolicies({ action: Action.Service, subject: 'reports' })
  @ApiOperation({
    summary:
      'Technician performance: delivered orders, primary revenue, turnaround',
  })
  workshopTechnicians(@Query() q: ReportQueryDto) {
    return this.workshop.technicians(new ReportScope(q));
  }

  @Get('workshop/parts')
  @CheckPolicies({ action: Action.Service, subject: 'reports' })
  @ApiOperation({ summary: 'Parts used on service orders, ranked by cost' })
  workshopParts(@Query() q: ReportQueryDto) {
    return this.workshop.parts(new ReportScope(q), q.limit ?? 10);
  }

  @Get('workshop/in-service')
  @CheckPolicies({ action: Action.Service, subject: 'reports' })
  @ApiOperation({ summary: 'Bikes currently in service per status' })
  workshopInService(@Query() q: ReportQueryDto) {
    return this.workshop.inService(new ReportScope(q));
  }

  @Get('workshop/turnaround')
  @CheckPolicies({ action: Action.Service, subject: 'reports' })
  @ApiOperation({
    summary: 'Average and median days from drop-off to delivery',
  })
  workshopTurnaround(@Query() q: ReportQueryDto) {
    return this.workshop.turnaround(new ReportScope(q));
  }

  // ==================== DASHBOARD ====================

  @Get('dashboard/kpis')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary: 'Dashboard KPIs: today and month to date, retail and workshop',
  })
  dashboardKpis(@Query() q: ReportQueryDto) {
    return this.financial.dashboardKpis(q.storeId);
  }
}
