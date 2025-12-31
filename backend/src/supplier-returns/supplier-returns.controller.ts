import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierReturnsService } from './supplier-returns.service';
import { CreateSupplierReturnDto } from './dto/create-supplier-return.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('supplier-returns')
@ApiBearerAuth()
@Controller('supplier-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierReturnsController {
  constructor(
    private readonly supplierReturnsService: SupplierReturnsService,
  ) {}

  @Post()
  @Roles('manager', 'warehouse_staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier return' })
  create(@Body() createSupplierReturnDto: CreateSupplierReturnDto) {
    const userId = 'user-id-from-jwt'; // Placeholder
    return this.supplierReturnsService.create(createSupplierReturnDto, userId);
  }

  @Get()
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get all supplier returns' })
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.supplierReturnsService.findAll(
      supplierId,
      status,
      startDate,
      endDate,
    );
  }

  @Get('supplier/:supplierId')
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get all returns for a specific supplier' })
  findBySupplier(@Param('supplierId') supplierId: string) {
    return this.supplierReturnsService.findBySupplier(supplierId);
  }

  @Get(':id')
  @Roles('manager', 'warehouse_staff', 'finance')
  @ApiOperation({ summary: 'Get a single supplier return' })
  findOne(@Param('id') id: string) {
    return this.supplierReturnsService.findOne(id);
  }

  @Post(':id/approve')
  @Roles('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a supplier return and update stock' })
  approve(@Param('id') id: string) {
    const userId = 'user-id-from-jwt'; // Placeholder
    return this.supplierReturnsService.approve(id, userId);
  }
}
