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
import { EodReportsService } from './eod-reports.service';
import { FinancialReportsService } from './financial-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { LedgerReportsService } from './ledger-reports.service';
import { ReportExportInterceptor } from './report-export.interceptor';
import { ReportScope } from './report-scope';
import { RetailReportsService } from './retail-reports.service';
import { SalesReportsService } from './sales-reports.service';
import { StockReportsService } from './stock-reports.service';
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
    private readonly eod: EodReportsService,
    private readonly retail: RetailReportsService,
    private readonly stock: StockReportsService,
    private readonly ledger: LedgerReportsService,
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

  // ==================== RETAIL SUITE ====================

  @Get('eod/daily')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary:
      'End of day per branch: sales, discounts by source, returns, money received by method, drawer cash, new receivables',
  })
  eodDaily(@Query() q: ReportQueryDto) {
    return this.eod.daily(new ReportScope(q));
  }

  @Get('eod/shifts')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary:
      'Shift close: float, cash sales, refunds, cash in/out, expected, counted, over/short',
  })
  eodShifts(@Query() q: ReportQueryDto) {
    return this.eod.shifts(new ReportScope(q));
  }

  @Get('sales/by-hour')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Orders and net sales per hour of day' })
  salesByHour(@Query() q: ReportQueryDto) {
    return this.retail.byHour(new ReportScope(q));
  }

  @Get('sales/by-staff')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Orders, net sales and returns per salesperson' })
  salesByStaff(@Query() q: ReportQueryDto) {
    return this.retail.byStaff(new ReportScope(q));
  }

  @Get('sales/by-branch')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Net sales per branch and channel' })
  salesByBranch(@Query() q: ReportQueryDto) {
    return this.retail.byBranch(new ReportScope(q));
  }

  @Get('sales/by-brand')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Net sales per brand' })
  salesByBrand(@Query() q: ReportQueryDto) {
    return this.retail.byBrand(new ReportScope(q));
  }

  @Get('sales/slow-movers')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Items in stock that sold least in the period' })
  salesSlowMovers(@Query() q: ReportQueryDto) {
    return this.retail.slowMovers(
      new ReportScope(q),
      isExport(q) ? 5000 : (q.limit ?? 50),
    );
  }

  @Get('sales/discounts')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Discounts by source per period' })
  salesDiscounts(@Query() q: ReportQueryDto) {
    return this.retail.discounts(new ReportScope(q));
  }

  @Get('returns/by-product')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary: 'Returned quantity, value and return rate per product',
  })
  returnsByProduct(@Query() q: ReportQueryDto) {
    return this.retail.returnsByProduct(
      new ReportScope(q),
      isExport(q) ? 5000 : (q.limit ?? 100),
    );
  }

  @Get('returns/reasons')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Returns by reason, or by staff with type=staff' })
  returnsReasons(@Query() q: ReportQueryDto) {
    return this.retail.returnsReasons(new ReportScope(q), q.type);
  }

  @Get('inventory/stock-card')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary:
      'Stock card of one product (productId, optional locationId) with running balance',
  })
  stockCard(@Query() q: ReportQueryDto) {
    return this.stock.stockCard(new ReportScope(q), q.productId, q.locationId);
  }

  @Get('inventory/in-transit')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({ summary: 'Transfers shipped and not yet fully received' })
  inTransit(@Query() q: ReportQueryDto) {
    return this.stock.inTransit(new ReportScope(q));
  }

  @Get('inventory/count-variances')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary: 'Differences found by stock counts completed in the period',
  })
  countVariances(@Query() q: ReportQueryDto) {
    return this.stock.countVariances(new ReportScope(q), q.locationId);
  }

  @Get('inventory/days-of-stock')
  @CheckPolicies({ action: Action.Inventory, subject: 'reports' })
  @ApiOperation({
    summary:
      'Days of stock left at the period sales rate; type=dead lists unsold stock',
  })
  daysOfStock(@Query() q: ReportQueryDto) {
    return this.stock.daysOfStock(
      new ReportScope(q),
      q.type,
      isExport(q) ? 5000 : (q.limit ?? 200),
    );
  }

  @Get('customers/top')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary: 'Customers ranked by net sales (sortBy=orders for order count)',
  })
  topCustomers(@Query() q: ReportQueryDto) {
    return this.retail.topCustomers(
      new ReportScope(q),
      isExport(q) ? 5000 : (q.limit ?? 20),
      q.sortBy,
    );
  }

  @Get('customers/receivables-aging')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({
    summary:
      'Open customer receivables by age (0–30, 31–60, 61–90, over 90 days)',
  })
  receivablesAging(@Query() q: ReportQueryDto) {
    return this.ledger.receivablesAging(new ReportScope(q));
  }

  @Get('customers/loyalty')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({ summary: 'Points earned, redeemed and balances per tier' })
  loyalty(@Query() q: ReportQueryDto) {
    return this.retail.loyalty(new ReportScope(q));
  }

  @Get('suppliers/purchases')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({
    summary: 'Purchases, returns, payments and balance per supplier',
  })
  supplierPurchases(@Query() q: ReportQueryDto) {
    return this.ledger.supplierPurchases(new ReportScope(q));
  }

  @Get('suppliers/payables-aging')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({ summary: 'Open supplier payables by age' })
  payablesAging(@Query() q: ReportQueryDto) {
    return this.ledger.payablesAging(new ReportScope(q));
  }

  @Get('promotions/performance')
  @CheckPolicies({ action: Action.Sales, subject: 'reports' })
  @ApiOperation({
    summary:
      'Orders, discount and net sales per promotion and voucher campaign',
  })
  promotionPerformance(@Query() q: ReportQueryDto) {
    return this.retail.promotionPerformance(new ReportScope(q));
  }

  @Get('financial/cash-balances')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({
    summary: 'Opening, in, out and closing per cash book account',
  })
  cashBalances(@Query() q: ReportQueryDto) {
    return this.ledger.cashBalances(new ReportScope(q));
  }

  @Get('financial/pnl')
  @CheckPolicies({ action: Action.Financial, subject: 'reports' })
  @ApiOperation({ summary: 'Profit and loss: retail, workshop and combined' })
  pnl(@Query() q: ReportQueryDto) {
    return this.ledger.pnl(new ReportScope(q));
  }
}
