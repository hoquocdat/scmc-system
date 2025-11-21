import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Action } from '../casl/casl-ability.factory';

@ApiTags('Service Orders')
@ApiBearerAuth('JWT-auth')
@Controller('service-orders')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  @CheckPolicies({ action: Action.Read, subject: 'service_orders' })
  @ApiOperation({ summary: 'Get all service orders with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'employee', required: false, type: String, description: 'Filter by employee IDs (comma-separated)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (comma-separated)' })
  @ApiQuery({ name: 'priority', required: false, type: String, description: 'Filter by priority (comma-separated)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by order number, license plate, or customer name' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of service orders' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('employee') employee?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
  ) {
    // Parse comma-separated values into arrays
    const employeeArray = employee ? employee.split(',').filter(Boolean) : undefined;
    const statusArray = status ? status.split(',').filter(Boolean) : undefined;
    const priorityArray = priority ? priority.split(',').filter(Boolean) : undefined;

    return this.serviceOrdersService.findAll(
      page || 1,
      limit || 10,
      employeeArray,
      statusArray,
      priorityArray,
      search,
    );
  }

  @Get('stats/in-service')
  @ApiOperation({ summary: 'Get count of bikes currently in service' })
  @ApiResponse({ status: 200, description: 'Returns count of bikes in service (excludes delivered and cancelled)' })
  async getBikesInServiceCount() {
    return this.serviceOrdersService.getBikesInServiceCount();
  }

  @Get('stats/dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Returns comprehensive dashboard stats' })
  async getDashboardStats() {
    return this.serviceOrdersService.getDashboardStats();
  }

  @Get('technician/:technicianId')
  @ApiOperation({ summary: 'Get service orders by technician/employee ID' })
  @ApiParam({ name: 'technicianId', description: 'Technician/Employee UUID' })
  @ApiResponse({ status: 200, description: 'Returns service orders assigned to technician' })
  async findByEmployee(@Param('technicianId') technicianId: string) {
    return this.serviceOrdersService.findByEmployee(technicianId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service order by ID' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Returns service order details' })
  @ApiResponse({ status: 404, description: 'Service order not found' })
  async findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOne(id);
  }

  @Get(':id/technicians')
  @ApiOperation({ summary: 'Get assigned technicians for service order' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of assigned technicians' })
  async getEmployees(@Param('id') id: string) {
    return this.serviceOrdersService.getEmployees(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new service order' })
  @ApiResponse({ status: 201, description: 'Service order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createServiceOrderDto: CreateServiceOrderDto) {
    return this.serviceOrdersService.create(createServiceOrderDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update service order by ID' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Service order updated successfully' })
  @ApiResponse({ status: 404, description: 'Service order not found' })
  async update(
    @Param('id') id: string,
    @Body() updateServiceOrderDto: UpdateServiceOrderDto,
  ) {
    return this.serviceOrdersService.update(id, updateServiceOrderDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update service order status' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Service order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.serviceOrdersService.updateStatus(id, updateStatusDto);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign technician/employee to service order' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Employee assigned successfully' })
  @ApiResponse({ status: 404, description: 'Service order or employee not found' })
  async assignEmployee(
    @Param('id') id: string,
    @Body() assignEmployeeDto: AssignEmployeeDto,
  ) {
    return this.serviceOrdersService.assignEmployee(id, assignEmployeeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel service order' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Service order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Service order not found' })
  async cancel(@Param('id') id: string) {
    return this.serviceOrdersService.cancel(id);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload service order image' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  async uploadImage(
    @Param('id') id: string,
    @Body() body: { file: string; mimeType: string },
  ) {
    const imageUrl = await this.serviceOrdersService.uploadImage(
      id,
      body.file,
      body.mimeType,
    );
    return { imageUrl };
  }

  @Delete(':id/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete service order image' })
  @ApiParam({ name: 'id', description: 'Service Order UUID' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  async deleteImage(@Param('id') id: string) {
    await this.serviceOrdersService.deleteImage(id);
    return { message: 'Image deleted successfully' };
  }
}
