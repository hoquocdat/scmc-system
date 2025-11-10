import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
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
}
