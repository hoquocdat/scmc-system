import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto, OrderStatus } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles('manager', 'store_manager', 'sales_associate')
  @ApiOperation({ summary: 'Create a new sales order' })
  @ApiResponse({ status: 201, description: 'Sales order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createSalesOrderDto: CreateSalesOrderDto) {
    return this.salesService.create(createSalesOrderDto);
  }

  @Get()
  @Roles('manager', 'store_manager', 'sales_associate', 'finance')
  @ApiOperation({ summary: 'Get all sales orders with filtering' })
  @ApiResponse({ status: 200, description: 'Sales orders retrieved successfully' })
  findAll(@Query() query: SalesOrderQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get('statistics')
  @Roles('manager', 'store_manager', 'finance')
  @ApiOperation({ summary: 'Get sales statistics' })
  @ApiQuery({ name: 'from_date', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'to_date', required: false, description: 'Filter to date (ISO 8601)' })
  @ApiQuery({ name: 'created_by', required: false, description: 'Filter by employee ID' })
  @ApiQuery({ name: 'channel', required: false, description: 'Filter by sales channel' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getStatistics(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('created_by') createdBy?: string,
    @Query('channel') channel?: string,
  ) {
    return this.salesService.getStatistics({
      from_date: fromDate,
      to_date: toDate,
      created_by: createdBy,
      channel,
    });
  }

  @Get('reports/employees')
  @Roles('manager', 'store_manager', 'finance', 'sales_associate')
  @ApiOperation({ summary: 'Get list of employees who have created sales orders' })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  getSalesEmployees() {
    return this.salesService.getSalesEmployees();
  }

  @Get('reports/by-employee')
  @Roles('manager', 'store_manager', 'finance')
  @ApiOperation({ summary: 'Get sales report by employee' })
  @ApiQuery({ name: 'from_date', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'to_date', required: false, description: 'Filter to date (ISO 8601)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filter by specific employee UUID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  getReportByEmployee(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('employee_id') employeeId?: string,
  ) {
    return this.salesService.getReportByEmployee({
      from_date: fromDate,
      to_date: toDate,
      employee_id: employeeId,
    });
  }

  @Get('reports/by-channel')
  @Roles('manager', 'store_manager', 'finance')
  @ApiOperation({ summary: 'Get sales report by channel' })
  @ApiQuery({ name: 'from_date', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'to_date', required: false, description: 'Filter to date (ISO 8601)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filter by specific employee UUID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  getReportByChannel(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('employee_id') employeeId?: string,
  ) {
    return this.salesService.getReportByChannel({
      from_date: fromDate,
      to_date: toDate,
      employee_id: employeeId,
    });
  }

  @Get(':id')
  @Roles('manager', 'store_manager', 'sales_associate', 'finance')
  @ApiOperation({ summary: 'Get a single sales order by ID' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiResponse({ status: 200, description: 'Sales order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Sales order not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
  @Roles('manager', 'store_manager', 'sales_associate')
  @ApiOperation({ summary: 'Update a sales order' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiResponse({ status: 200, description: 'Sales order updated successfully' })
  @ApiResponse({ status: 404, description: 'Sales order not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSalesOrderDto: UpdateSalesOrderDto,
  ) {
    return this.salesService.update(id, updateSalesOrderDto);
  }

  @Post(':id/confirm')
  @Roles('manager', 'store_manager', 'sales_associate')
  @ApiOperation({ summary: 'Confirm a draft sales order' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiResponse({ status: 200, description: 'Sales order confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot confirm order' })
  @ApiResponse({ status: 404, description: 'Sales order not found' })
  confirm(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.salesService.confirm(id, req.user?.id);
  }

  @Post(':id/status')
  @Roles('manager', 'store_manager', 'sales_associate')
  @ApiOperation({ summary: 'Update sales order status' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Sales order not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: OrderStatus,
    @Request() req: any,
  ) {
    return this.salesService.updateStatus(id, status, req.user?.id);
  }

  @Post(':id/cancel')
  @Roles('manager', 'store_manager')
  @ApiOperation({ summary: 'Cancel a sales order and reverse inventory' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiResponse({ status: 200, description: 'Sales order cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel order' })
  @ApiResponse({ status: 404, description: 'Sales order not found' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.cancel(id);
  }

  @Post('payments')
  @Roles('manager', 'store_manager', 'sales_associate', 'finance')
  @ApiOperation({ summary: 'Add payment to a sales order' })
  @ApiResponse({ status: 201, description: 'Payment added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  addPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.salesService.addPayment(createPaymentDto);
  }

  @Post(':id/items')
  @Roles('manager', 'store_manager', 'sales_associate')
  @ApiOperation({ summary: 'Add item to an unpaid sales order' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiResponse({ status: 201, description: 'Item added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Sales order not found' })
  @ApiResponse({ status: 409, description: 'Cannot add items to this order' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addItemDto: AddOrderItemDto,
  ) {
    return this.salesService.addItem(id, addItemDto);
  }

  @Delete(':id/items/:itemId')
  @Roles('manager', 'store_manager', 'sales_associate')
  @ApiOperation({ summary: 'Remove item from an unpaid sales order' })
  @ApiParam({ name: 'id', description: 'Sales Order UUID' })
  @ApiParam({ name: 'itemId', description: 'Order Item UUID' })
  @ApiResponse({ status: 200, description: 'Item removed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Sales order or item not found' })
  @ApiResponse({ status: 409, description: 'Cannot remove items from this order' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.salesService.removeItem(id, itemId);
  }
}
