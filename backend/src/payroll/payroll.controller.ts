import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import {
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  PayrollPeriodQueryDto,
  AdjustPayrollSlipDto,
  ConfirmPayrollDto,
  DisputePayrollDto,
  ResolveDisputeDto,
  FinalizePeriodDto,
  MarkPaidDto,
  MyPayrollQueryDto,
} from './dto/payroll.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetCurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ========== PAYROLL PERIODS (Admin) ==========

  @Post('periods')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Create a new payroll period' })
  @ApiResponse({ status: 201, description: 'Payroll period created' })
  async createPeriod(
    @Body() dto: CreatePayrollPeriodDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.createPeriod(dto, user.id);
  }

  @Get('periods')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get all payroll periods' })
  @ApiResponse({ status: 200, description: 'List of payroll periods' })
  async getPeriods(@Query() query: PayrollPeriodQueryDto) {
    return this.payrollService.getPeriods(query);
  }

  @Get('periods/:id')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get payroll period by ID' })
  @ApiResponse({ status: 200, description: 'Payroll period details' })
  async getPeriod(@Param('id') id: string) {
    return this.payrollService.getPeriod(id);
  }

  @Patch('periods/:id')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Update payroll period' })
  @ApiResponse({ status: 200, description: 'Payroll period updated' })
  async updatePeriod(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollPeriodDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.updatePeriod(id, dto, user.id);
  }

  // ========== PAYROLL GENERATION ==========

  @Post('periods/:id/generate')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Generate payroll slips for a period' })
  @ApiResponse({ status: 200, description: 'Payroll generated' })
  async generatePayroll(
    @Param('id') id: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.generatePayroll(id, user.id);
  }

  // ========== WORKFLOW ACTIONS ==========

  @Post('periods/:id/publish')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Publish payroll period to employees' })
  @ApiResponse({ status: 200, description: 'Period published' })
  async publishPeriod(
    @Param('id') id: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.publishPeriod(id, user.id);
  }

  @Post('periods/:id/finalize')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Finalize payroll period' })
  @ApiResponse({ status: 200, description: 'Period finalized' })
  async finalizePeriod(
    @Param('id') id: string,
    @Body() dto: FinalizePeriodDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.finalizePeriod(id, dto, user.id);
  }

  @Post('periods/:id/mark-paid')
  @UseGuards(RolesGuard)
  @Roles('finance')
  @ApiOperation({ summary: 'Mark payroll period as paid' })
  @ApiResponse({ status: 200, description: 'Period marked as paid' })
  async markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.markPaid(id, dto, user.id);
  }

  // ========== PAYROLL SLIPS (Admin) ==========

  @Get('periods/:id/slips')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get all slips for a period' })
  @ApiResponse({ status: 200, description: 'List of payroll slips' })
  async getSlipsForPeriod(@Param('id') id: string) {
    return this.payrollService.getSlipsForPeriod(id);
  }

  @Get('slips/:id')
  @ApiOperation({ summary: 'Get payroll slip details' })
  @ApiResponse({ status: 200, description: 'Payroll slip details' })
  async getSlip(@Param('id') id: string, @GetCurrentUser() user: CurrentUser) {
    // Check if admin
    const isAdmin = ['manager', 'finance'].includes(user.role);
    return this.payrollService.getSlip(id, user.id, isAdmin);
  }

  @Patch('slips/:id/adjust')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Adjust payroll slip' })
  @ApiResponse({ status: 200, description: 'Slip adjusted' })
  async adjustSlip(
    @Param('id') id: string,
    @Body() dto: AdjustPayrollSlipDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.adjustSlip(id, dto, user.id);
  }

  // ========== EMPLOYEE SELF-SERVICE ==========

  @Get('my-payroll')
  @ApiOperation({ summary: 'Get my payroll slips' })
  @ApiResponse({ status: 200, description: 'My payroll slips' })
  async getMyPayroll(
    @GetCurrentUser() user: CurrentUser,
    @Query() query: MyPayrollQueryDto,
  ) {
    return this.payrollService.getMyPayroll(user.id, query);
  }

  @Post('slips/:id/confirm')
  @ApiOperation({ summary: 'Confirm payroll slip' })
  @ApiResponse({ status: 200, description: 'Slip confirmed' })
  async confirmSlip(
    @Param('id') id: string,
    @Body() dto: ConfirmPayrollDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.confirmSlip(id, dto, user.id);
  }

  @Post('slips/:id/dispute')
  @ApiOperation({ summary: 'Dispute payroll slip' })
  @ApiResponse({ status: 200, description: 'Dispute raised' })
  async disputeSlip(
    @Param('id') id: string,
    @Body() dto: DisputePayrollDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.disputeSlip(id, dto, user.id);
  }

  @Post('slips/:id/resolve-dispute')
  @UseGuards(RolesGuard)
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Resolve dispute' })
  @ApiResponse({ status: 200, description: 'Dispute resolved' })
  async resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.payrollService.resolveDispute(id, dto, user.id);
  }
}
