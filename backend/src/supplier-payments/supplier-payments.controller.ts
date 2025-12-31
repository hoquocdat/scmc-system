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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierPaymentsService } from './supplier-payments.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('supplier-payments')
@ApiBearerAuth()
@Controller('supplier-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierPaymentsController {
  constructor(
    private readonly supplierPaymentsService: SupplierPaymentsService,
  ) {}

  @Post()
  @Roles('finance', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier payment' })
  create(@Body() createSupplierPaymentDto: CreateSupplierPaymentDto, @Request() req: any) {
    const userId = req.user?.id || null;
    return this.supplierPaymentsService.create(createSupplierPaymentDto, userId);
  }

  @Get()
  @Roles('finance', 'manager')
  @ApiOperation({ summary: 'Get all supplier payments' })
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.supplierPaymentsService.findAll(supplierId, startDate, endDate);
  }

  @Get('supplier/:supplierId')
  @Roles('finance', 'manager')
  @ApiOperation({ summary: 'Get all payments for a specific supplier' })
  findBySupplier(@Param('supplierId') supplierId: string) {
    return this.supplierPaymentsService.findBySupplier(supplierId);
  }

  @Get(':id')
  @Roles('finance', 'manager')
  @ApiOperation({ summary: 'Get a single supplier payment' })
  findOne(@Param('id') id: string) {
    return this.supplierPaymentsService.findOne(id);
  }
}
