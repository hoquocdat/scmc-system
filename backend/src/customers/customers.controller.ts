import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RecordReceivablePaymentDto } from './dto/record-receivable-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Customers')
@ApiBearerAuth('JWT-auth')
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of customers' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.findAll(page || 1, limit || 10);
  }

  @Get('check-phone/:phone')
  @ApiOperation({ summary: 'Check if phone number is available' })
  @ApiParam({ name: 'phone', description: 'Phone number to check' })
  @ApiResponse({ status: 200, description: 'Returns availability status' })
  async checkPhoneAvailability(@Param('phone') phone: string) {
    return this.customersService.checkPhoneAvailability(phone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Returns customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Get(':id/receivables')
  @ApiOperation({ summary: 'Get customer receivables (công nợ)' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Returns customer receivables with summary' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getReceivables(@Param('id') id: string) {
    return this.customersService.getReceivables(id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get customer order history' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of customer orders' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getOrders(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.getOrders(id, page || 1, limit || 10);
  }

  @Post(':id/receivables/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a payment against customer receivables',
    description:
      'Record a payment for a customer. If sales_order_id is provided, payment is applied to that specific order. Otherwise, payment is applied using FIFO to oldest unpaid orders.',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({
    status: 200,
    description: 'Payment recorded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async recordReceivablePayment(
    @Param('id') id: string,
    @Body() dto: RecordReceivablePaymentDto,
  ) {
    // Ensure customer_id in DTO matches the URL param
    dto.customer_id = id;
    return this.customersService.recordReceivablePayment(dto);
  }

  @Get(':id/receivables/payments')
  @ApiOperation({ summary: 'Get payment history for customer receivables' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of all payments for customer orders',
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getReceivablePaymentHistory(@Param('id') id: string) {
    return this.customersService.getReceivablePaymentHistory(id);
  }
}
