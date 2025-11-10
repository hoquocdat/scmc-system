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
import { InventoryService } from './inventory.service';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
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

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('manager', 'store_manager', 'warehouse_staff', 'sales_associate')
  @ApiOperation({ summary: 'Get all inventory records with filtering' })
  @ApiResponse({ status: 200, description: 'Inventory records retrieved successfully' })
  findAll(@Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('stock-levels')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Get current stock levels across all locations' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Stock levels retrieved successfully' })
  getStockLevels(@Query('locationId') locationId?: string) {
    return this.inventoryService.getStockLevels(locationId);
  }

  @Get('transactions')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Get inventory transaction history' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'variantId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Transaction history retrieved successfully' })
  getTransactionHistory(
    @Query('locationId') locationId?: string,
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getTransactionHistory(
      locationId,
      productId,
      variantId,
      page,
      limit,
    );
  }

  @Get(':id')
  @Roles('manager', 'store_manager', 'warehouse_staff', 'sales_associate')
  @ApiOperation({ summary: 'Get a single inventory record by ID' })
  @ApiParam({ name: 'id', description: 'Inventory UUID' })
  @ApiResponse({ status: 200, description: 'Inventory record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory record not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id);
  }

  @Get('location/:locationId/product/:productId')
  @Roles('manager', 'store_manager', 'warehouse_staff', 'sales_associate')
  @ApiOperation({ summary: 'Get inventory for specific location and product' })
  @ApiParam({ name: 'locationId', description: 'Location UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiQuery({ name: 'variantId', required: false, description: 'Product Variant UUID' })
  @ApiResponse({ status: 200, description: 'Inventory record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory record not found' })
  findByLocationAndProduct(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.inventoryService.findByLocationAndProduct(locationId, productId, variantId);
  }

  @Patch(':id')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Update inventory record (manual adjustment)' })
  @ApiParam({ name: 'id', description: 'Inventory UUID' })
  @ApiResponse({ status: 200, description: 'Inventory updated successfully' })
  @ApiResponse({ status: 404, description: 'Inventory record not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Post('transactions')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({
    summary: 'Create inventory transaction (receive, adjust, transfer, sale, return)',
  })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  createTransaction(@Body() createTransactionDto: CreateInventoryTransactionDto) {
    return this.inventoryService.createTransaction(createTransactionDto);
  }

  @Post('adjust')
  @Roles('manager', 'store_manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Quick stock adjustment' })
  @ApiResponse({ status: 201, description: 'Stock adjusted successfully' })
  adjustStock(
    @Body()
    body: {
      locationId: string;
      productId: string;
      quantity: number;
      reason: string;
      performedBy?: string;
      variantId?: string;
    },
  ) {
    return this.inventoryService.adjustStock(
      body.locationId,
      body.productId,
      body.quantity,
      body.reason,
      body.performedBy,
      body.variantId,
    );
  }
}
