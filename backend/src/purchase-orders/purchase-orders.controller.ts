import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AddPurchaseOrderItemDto } from './dto/add-purchase-order-item.dto';
import { UpdatePurchaseOrderItemDto } from './dto/update-purchase-order-item.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new purchase order' })
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto, @User() user: any) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, user?.sub);
  }

  @Get()
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get all purchase orders' })
  findAll(@Query() query: PurchaseOrderQueryDto) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get(':id')
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get a single purchase order' })
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @Roles('manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Update a purchase order (draft only)' })
  update(
    @Param('id') id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @User() user: any,
  ) {
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto, user?.sub);
  }

  @Post(':id/items')
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an item to a purchase order' })
  addItem(
    @Param('id') id: string,
    @Body() addPurchaseOrderItemDto: AddPurchaseOrderItemDto,
    @User() user: any,
  ) {
    return this.purchaseOrdersService.addItem(id, addPurchaseOrderItemDto, user?.sub);
  }

  @Patch(':id/items/:itemId')
  @Roles('manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Update a purchase order item' })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() updatePurchaseOrderItemDto: UpdatePurchaseOrderItemDto,
    @User() user: any,
  ) {
    return this.purchaseOrdersService.updateItem(
      id,
      itemId,
      updatePurchaseOrderItemDto,
      user?.sub,
    );
  }

  @Delete(':id/items/:itemId')
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an item from a purchase order' })
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @User() user: any) {
    return this.purchaseOrdersService.removeItem(id, itemId, user?.sub);
  }

  @Post(':id/submit')
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit purchase order for approval' })
  submitForApproval(@Param('id') id: string, @User() user: any) {
    return this.purchaseOrdersService.submitForApproval(id, user?.sub);
  }

  @Post(':id/approve')
  @Roles('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a purchase order and update stock' })
  approve(@Param('id') id: string, @User() user: any) {
    return this.purchaseOrdersService.approve(id, user?.sub);
  }

  @Post(':id/reject')
  @Roles('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a purchase order' })
  reject(@Param('id') id: string, @Body('reason') reason: string | undefined, @User() user: any) {
    return this.purchaseOrdersService.reject(id, user?.sub, reason);
  }

  @Post(':id/cancel')
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a draft purchase order' })
  cancel(@Param('id') id: string, @User() user: any) {
    return this.purchaseOrdersService.cancel(id, user?.sub);
  }

  @Delete(':id')
  @Roles('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a draft purchase order' })
  remove(@Param('id') id: string, @User() user: any) {
    return this.purchaseOrdersService.remove(id, user?.sub);
  }
}
