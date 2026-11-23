import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CashMovementDto } from './dto/cash-movement.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { ClosePosSessionDto } from './dto/close-pos-session.dto';
import { DiscountApprovalDto } from './dto/discount-approval.dto';
import { OpenShiftDto } from './dto/open-shift.dto';
import { PosSessionQueryDto } from './dto/pos-session-query.dto';
import { PosCheckoutService } from './pos-checkout.service';
import { PosService } from './pos.service';

/**
 * POS API: shifts (sessions) and checkout.
 *   pos:create  sell, open/close/cash-move own shift
 *   pos:manage  view and close other users' shifts
 *   pos:approve approve discounts above the role limit
 *   pos:credit  complete a sale with an unpaid balance (checked in the service)
 *   pos:reprint reprint receipts
 */
@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PosController {
  constructor(
    private readonly posService: PosService,
    private readonly checkoutService: PosCheckoutService,
  ) {}

  // ==================== SHIFTS ====================

  @Post('sessions')
  @CheckPolicies({ action: Action.Create, subject: 'pos' })
  @ApiOperation({ summary: 'Open a shift for the current user at a branch' })
  @ApiResponse({ status: 201, description: 'Shift opened' })
  @ApiResponse({
    status: 409,
    description: 'The user already has an open shift (returned in the body)',
  })
  openShift(@GetCurrentUser() user: CurrentUser, @Body() dto: OpenShiftDto) {
    return this.posService.openShift(user, dto);
  }

  @Get('sessions')
  @CheckPolicies({ action: Action.Read, subject: 'pos' })
  @ApiOperation({
    summary: 'List shifts (own shifts unless the user has pos:manage)',
  })
  findAll(
    @GetCurrentUser() user: CurrentUser,
    @Query() query: PosSessionQueryDto,
  ) {
    return this.posService.findAll(query, user);
  }

  @Get('sessions/current')
  @CheckPolicies({ action: Action.Read, subject: 'pos' })
  @ApiOperation({ summary: "The current user's open shift (404 when none)" })
  currentShift(@GetCurrentUser() user: CurrentUser) {
    return this.posService.getCurrentShift(user);
  }

  @Get('shifts/current')
  @CheckPolicies({ action: Action.Read, subject: 'pos' })
  @ApiOperation({ summary: 'Alias of GET /pos/sessions/current' })
  currentShiftAlias(@GetCurrentUser() user: CurrentUser) {
    return this.posService.getCurrentShift(user);
  }

  @Get('sessions/:id')
  @CheckPolicies({ action: Action.Read, subject: 'pos' })
  @ApiOperation({
    summary: 'One shift with its cash movements (own, or pos:manage)',
  })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  findOne(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posService.findOne(id, user);
  }

  @Get('sessions/:id/summary')
  @CheckPolicies({ action: Action.Read, subject: 'pos' })
  @ApiOperation({
    summary:
      'Shift summary: sales, money per method, credit, movements, expected vs counted cash',
  })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  summary(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posService.getSummary(id, user);
  }

  @Get('sessions/:id/stats')
  @CheckPolicies({ action: Action.Read, subject: 'pos' })
  @ApiOperation({ summary: 'Alias of GET /pos/sessions/:id/summary' })
  stats(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posService.getSummary(id, user);
  }

  @Patch('sessions/:id/close')
  @CheckPolicies({ action: Action.Create, subject: 'pos' })
  @ApiOperation({
    summary: 'Close a shift with the counted cash (own, or pos:manage)',
  })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  @ApiResponse({ status: 409, description: 'Shift already closed' })
  closeShift(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClosePosSessionDto,
  ) {
    return this.posService.closeShift(id, user, dto);
  }

  @Post('transactions')
  @CheckPolicies({ action: Action.Create, subject: 'pos' })
  @ApiOperation({ summary: 'Record cash in / cash out on an open shift' })
  @ApiResponse({ status: 409, description: 'Shift is closed' })
  addCashMovement(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CashMovementDto,
  ) {
    return this.posService.addCashMovement(user, dto);
  }

  // ==================== CHECKOUT ====================

  @Post('checkout')
  @CheckPolicies({ action: Action.Create, subject: 'pos' })
  @ApiOperation({
    summary:
      'Record a complete POS sale (order, lines, payments, stock, loyalty) in one atomic call',
  })
  @ApiResponse({
    status: 201,
    description: 'Sale recorded; the body is the receipt data',
  })
  @ApiResponse({
    status: 403,
    description: 'DISCOUNT_APPROVAL_REQUIRED or missing permission',
  })
  @ApiResponse({
    status: 409,
    description:
      'SHIFT_NOT_OPEN, PRICE_CHANGED (with new prices) or INSUFFICIENT_STOCK (with availability)',
  })
  @ApiResponse({
    status: 422,
    description: 'PAYMENT_RULE: payment or credit rule violated',
  })
  checkout(@GetCurrentUser() user: CurrentUser, @Body() dto: CheckoutDto) {
    return this.checkoutService.checkout(user, dto);
  }

  @Post('discount-approvals')
  @CheckPolicies({ action: Action.Approve, subject: 'pos' })
  @ApiOperation({
    summary:
      "Approve a discount for one cart; call with the approving user's own token. Returns a 5-minute token bound to the cart.",
  })
  approveDiscount(
    @GetCurrentUser() approver: CurrentUser,
    @Body() dto: DiscountApprovalDto,
  ) {
    return this.checkoutService.approveDiscount(approver, dto);
  }

  @Post('orders/:id/reprint')
  @CheckPolicies({ action: Action.Reprint, subject: 'pos' })
  @ApiOperation({
    summary: 'Receipt data for a past POS order; the reprint is logged',
  })
  @ApiParam({ name: 'id', description: 'Sales order UUID' })
  reprint(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checkoutService.reprint(user, id);
  }
}
