import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { ReportExportInterceptor } from '../reports/report-export.interceptor';
import { CashBookService } from './cash-book.service';
import {
  BalanceQueryDto,
  CancelEntryDto,
  CreateAccountDto,
  CreateCategoryDto,
  CreateOpeningBalanceDto,
  CreateTransferDto,
  CreateVoucherDto,
  EntryQueryDto,
  SetMethodAccountDto,
  UpdateAccountDto,
  UpdateCategoryDto,
} from './dto/cash-book.dto';

/**
 * Cash book (sổ quỹ) API. Permissions (subject cash_book):
 *   read · receive (receipt vouchers) · pay (payment vouchers) · transfer ·
 *   cancel · configure (accounts, mapping, categories, opening balances)
 */
@ApiTags('cash-book')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('cash-book')
export class CashBookController {
  constructor(private readonly cashBook: CashBookService) {}

  // ---- entries ----

  @Get('entries')
  @UseInterceptors(ReportExportInterceptor)
  @ApiProduces(
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  )
  @CheckPolicies({ action: Action.Read, subject: 'cash_book' })
  @ApiOperation({
    summary:
      'Entries with filters; with accountId: opening/closing balance and running balance. format=xlsx|csv exports every matching row (needs reports:export).',
  })
  listEntries(@Query() q: EntryQueryDto) {
    return this.cashBook.listEntries(
      q,
      q.format === 'xlsx' || q.format === 'csv',
    );
  }

  @Get('entries/:id')
  @CheckPolicies({ action: Action.Read, subject: 'cash_book' })
  @ApiOperation({ summary: 'One entry with its attachments' })
  getEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashBook.getEntry(id);
  }

  @Get('balances')
  @CheckPolicies({ action: Action.Read, subject: 'cash_book' })
  @ApiOperation({
    summary: 'Balance per account and branch at the end of a day (default now)',
  })
  balances(@Query() q: BalanceQueryDto) {
    return this.cashBook.balances(q);
  }

  @Post('receipts')
  @CheckPolicies({ action: Action.Receive, subject: 'cash_book' })
  @ApiOperation({ summary: 'Record a receipt voucher (phiếu thu)' })
  @ApiResponse({
    status: 422,
    description: 'CASH_BOOK_RULE or CASH_ACCOUNT_NOT_CONFIGURED',
  })
  createReceipt(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateVoucherDto,
  ) {
    return this.cashBook.createVoucher(user, 'in', dto);
  }

  @Post('payments')
  @CheckPolicies({ action: Action.Pay, subject: 'cash_book' })
  @ApiOperation({ summary: 'Record a payment voucher (phiếu chi)' })
  createPayment(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateVoucherDto,
  ) {
    return this.cashBook.createVoucher(user, 'out', dto);
  }

  @Post('transfers')
  @CheckPolicies({ action: Action.Transfer, subject: 'cash_book' })
  @ApiOperation({
    summary:
      'Move money between two accounts (payment on source, receipt on destination)',
  })
  createTransfer(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateTransferDto,
  ) {
    return this.cashBook.createTransfer(user, dto);
  }

  @Post('opening-balances')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({
    summary: "Set an account's opening balance (one posted per account)",
  })
  createOpeningBalance(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateOpeningBalanceDto,
  ) {
    return this.cashBook.createOpeningBalance(user, dto);
  }

  @Post('entries/:id/cancel')
  @CheckPolicies({ action: Action.Cancel, subject: 'cash_book' })
  @ApiOperation({
    summary:
      'Cancel a manual voucher, a transfer (both sides) or an opening balance',
  })
  @ApiResponse({
    status: 409,
    description: 'AUTOMATIC_ENTRY: reverse the source document instead',
  })
  cancel(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelEntryDto,
  ) {
    return this.cashBook.cancelEntry(user, id, dto);
  }

  // ---- accounts & mapping ----

  @Get('accounts')
  @CheckPolicies({ action: Action.Read, subject: 'cash_book' })
  @ApiOperation({ summary: 'Accounts with current balances' })
  listAccounts(@Query() q: BalanceQueryDto) {
    return this.cashBook.listAccounts(q.storeId);
  }

  @Post('accounts')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({ summary: 'Create an account (one POS drawer per branch)' })
  createAccount(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.cashBook.createAccount(user, dto);
  }

  @Patch('accounts/:id')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({
    summary:
      'Update an account (mapped or POS drawer accounts cannot be deactivated)',
  })
  updateAccount(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.cashBook.updateAccount(user, id, dto);
  }

  @Get('accounts/method-map')
  @CheckPolicies({ action: Action.Read, subject: 'cash_book' })
  @ApiOperation({ summary: 'Payment method to account mapping per branch' })
  methodMap(@Query() q: BalanceQueryDto) {
    return this.cashBook.methodMap(q.storeId);
  }

  @Put('accounts/method-map')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({
    summary: 'Map a payment method of a branch to one of its active accounts',
  })
  setMethodAccount(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: SetMethodAccountDto,
  ) {
    return this.cashBook.setMethodAccount(user, dto);
  }

  // ---- categories ----

  @Get('categories')
  @CheckPolicies({ action: Action.Read, subject: 'cash_book' })
  @ApiOperation({ summary: 'Categories (direction=in|out)' })
  listCategories(@Query('direction') direction?: 'in' | 'out') {
    return this.cashBook.listCategories(
      direction === 'in' || direction === 'out' ? direction : undefined,
    );
  }

  @Post('categories')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({ summary: 'Add a category' })
  createCategory(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.cashBook.createCategory(user, dto);
  }

  @Patch('categories/:id')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({
    summary:
      'Rename or (de)activate a category; system categories cannot be deactivated',
  })
  updateCategory(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.cashBook.updateCategory(user, id, dto);
  }

  @Delete('categories/:id')
  @CheckPolicies({ action: Action.Configure, subject: 'cash_book' })
  @ApiOperation({ summary: 'Delete an unused, non-system category' })
  deleteCategory(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cashBook.deleteCategory(user, id);
  }
}
