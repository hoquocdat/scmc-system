import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get all suppliers' })
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get a single supplier' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Get(':id/details')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get supplier details with accounts payable info' })
  getSupplierDetails(@Param('id') id: string) {
    return this.suppliersService.getSupplierDetails(id);
  }

  @Get(':id/accounts-payable')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get supplier accounts payable balance' })
  getAccountsPayable(@Param('id') id: string) {
    return this.suppliersService.getAccountsPayable(id);
  }

  @Get(':id/transaction-history')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get supplier transaction history' })
  getTransactionHistory(@Param('id') id: string) {
    return this.suppliersService.getTransactionHistory(id);
  }

  @Get(':id/purchase-history')
  @Roles('manager', 'finance', 'warehouse_staff')
  @ApiOperation({ summary: 'Get supplier purchase history (approved POs only)' })
  getPurchaseHistory(@Param('id') id: string) {
    return this.suppliersService.getPurchaseHistory(id);
  }

  @Get(':id/outstanding-purchase-orders')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get outstanding unpaid purchase orders for supplier' })
  getOutstandingPurchaseOrders(@Param('id') id: string) {
    return this.suppliersService.getOutstandingPurchaseOrders(id);
  }

  @Patch(':id')
  @Roles('manager', 'warehouse_staff')
  @ApiOperation({ summary: 'Update a supplier' })
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @Roles('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a supplier' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
