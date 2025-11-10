import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ==================== SALES REPORTS ====================

  @Get('sales/summary')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get sales summary with totals and metrics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'location', required: false })
  async getSalesSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('location') location?: string,
  ) {
    return this.reportsService.getSalesSummary(startDate, endDate, location);
  }

  @Get('sales/by-category')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get sales breakdown by product category' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getSalesByCategory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByCategory(startDate, endDate);
  }

  @Get('sales/by-payment-method')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get sales breakdown by payment method' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getSalesByPaymentMethod(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesByPaymentMethod(startDate, endDate);
  }

  @Get('sales/top-products')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get top selling products' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getTopProducts(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getTopProducts(
      startDate,
      endDate,
      limit || 10,
    );
  }

  @Get('sales/trends')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get sales trends over time (daily/weekly/monthly)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'interval', required: false, enum: ['daily', 'weekly', 'monthly'] })
  async getSalesTrends(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    return this.reportsService.getSalesTrends(startDate, endDate, interval);
  }

  // ==================== INVENTORY REPORTS ====================

  @Get('inventory/valuation')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get inventory valuation by location and category' })
  @ApiQuery({ name: 'location', required: false })
  async getInventoryValuation(@Query('location') location?: string) {
    return this.reportsService.getInventoryValuation(location);
  }

  @Get('inventory/movement')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Get inventory movement report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'productId', required: false })
  async getInventoryMovement(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reportsService.getInventoryMovement(
      startDate,
      endDate,
      productId,
    );
  }

  @Get('inventory/low-stock')
  @Roles('manager', 'warehouse', 'admin')
  @ApiOperation({ summary: 'Get products below reorder point' })
  @ApiQuery({ name: 'location', required: false })
  async getLowStockProducts(@Query('location') location?: string) {
    return this.reportsService.getLowStockProducts(location);
  }

  @Get('inventory/turnover')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get inventory turnover analysis' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getInventoryTurnover(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getInventoryTurnover(startDate, endDate);
  }

  // ==================== FINANCIAL REPORTS ====================

  @Get('financial/revenue')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get revenue report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getRevenueReport(startDate, endDate);
  }

  @Get('financial/profit')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get profit & loss report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getProfitReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getProfitReport(startDate, endDate);
  }

  @Get('financial/vat')
  @Roles('finance', 'admin')
  @ApiOperation({ summary: 'Get VAT report for tax filing' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getVATReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getVATReport(startDate, endDate);
  }

  // ==================== DASHBOARD KPIs ====================

  @Get('dashboard/kpis')
  @Roles('manager', 'finance', 'admin')
  @ApiOperation({ summary: 'Get dashboard KPIs for today and current period' })
  async getDashboardKPIs() {
    return this.reportsService.getDashboardKPIs();
  }
}
