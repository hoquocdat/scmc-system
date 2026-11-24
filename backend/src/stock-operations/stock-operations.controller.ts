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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { ReportExportInterceptor } from '../reports/report-export.interceptor';
import { CodesService } from './codes.service';
import { CountsService } from './counts.service';
import {
  BaseUnitDto,
  CancelDto,
  CountEntryDto,
  CreateTransferDto,
  CreateWriteOffDto,
  ReceiveTransferDto,
  ReorderPoDto,
  SetBarcodeDto,
  ShipTransferDto,
  StartCountDto,
  TransferQueryDto,
  UnitDto,
  WriteOffQueryDto,
} from './dto/stock-operations.dto';
import { ReorderService } from './reorder.service';
import { TransfersService } from './transfers.service';
import { WriteOffsService } from './write-offs.service';

const read = { action: Action.Read, subject: 'inventory' } as const;

/** Transfers, counts, write-offs, barcodes, units and reorder alerts (change inventory-operations). */
@ApiTags('stock-operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class StockOperationsController {
  constructor(
    private readonly transfers: TransfersService,
    private readonly counts: CountsService,
    private readonly writeOffs: WriteOffsService,
    private readonly codes: CodesService,
    private readonly reorder: ReorderService,
  ) {}

  // ---------- transfers ----------
  @Get('stock-transfers')
  @CheckPolicies(read)
  listTransfers(@Query() q: TransferQueryDto) {
    return this.transfers.list(q);
  }

  @Get('stock-transfers/:id')
  @CheckPolicies(read)
  getTransfer(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfers.get(id);
  }

  @Post('stock-transfers')
  @CheckPolicies({ action: Action.Transfer, subject: 'inventory' })
  createTransfer(
    @GetCurrentUser() u: CurrentUser,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfers.create(u, dto);
  }

  @Post('stock-transfers/:id/ship')
  @CheckPolicies({ action: Action.Transfer, subject: 'inventory' })
  ship(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipTransferDto,
  ) {
    return this.transfers.ship(u, id, dto);
  }

  @Post('stock-transfers/:id/receive')
  @CheckPolicies({ action: Action.Transfer, subject: 'inventory' })
  receive(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
  ) {
    return this.transfers.receive(u, id, dto);
  }

  @Post('stock-transfers/:id/cancel')
  @CheckPolicies({ action: Action.Transfer, subject: 'inventory' })
  cancelTransfer(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDto,
  ) {
    return this.transfers.cancel(u, id, dto.reason);
  }

  // ---------- counts ----------
  @Get('stock-counts')
  @CheckPolicies(read)
  listCounts(@Query('locationId') locationId?: string) {
    return this.counts.list(locationId || undefined);
  }

  @Get('stock-counts/:id')
  @CheckPolicies(read)
  getCount(@Param('id', ParseUUIDPipe) id: string) {
    return this.counts.get(id);
  }

  @Post('stock-counts')
  @CheckPolicies({ action: Action.Count, subject: 'inventory' })
  startCount(@GetCurrentUser() u: CurrentUser, @Body() dto: StartCountDto) {
    return this.counts.start(u, dto);
  }

  @Post('stock-counts/:id/entries')
  @CheckPolicies({ action: Action.Count, subject: 'inventory' })
  @ApiOperation({
    summary: 'Set or add a counted quantity by line or by scanned code',
  })
  enter(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CountEntryDto,
  ) {
    return this.counts.enter(u, id, dto);
  }

  @Post('stock-counts/:id/complete')
  @CheckPolicies({ action: Action.ApproveCount, subject: 'inventory' })
  complete(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.counts.complete(u, id);
  }

  @Post('stock-counts/:id/cancel')
  @CheckPolicies({ action: Action.Count, subject: 'inventory' })
  cancelCount(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.counts.cancel(u, id);
  }

  // ---------- write-offs ----------
  @Get('stock-write-offs')
  @CheckPolicies(read)
  @UseInterceptors(ReportExportInterceptor)
  listWriteOffs(@Query() q: WriteOffQueryDto) {
    return this.writeOffs.list(q);
  }

  @Get('stock-write-offs/:id')
  @CheckPolicies(read)
  getWriteOff(@Param('id', ParseUUIDPipe) id: string) {
    return this.writeOffs.get(id);
  }

  @Post('stock-write-offs')
  @CheckPolicies({ action: Action.WriteOff, subject: 'inventory' })
  createWriteOff(
    @GetCurrentUser() u: CurrentUser,
    @Body() dto: CreateWriteOffDto,
  ) {
    return this.writeOffs.create(u, dto);
  }

  // ---------- barcodes, units ----------
  @Get('inventory-codes/lookup')
  @CheckPolicies(read)
  @ApiOperation({ summary: 'Barcode or SKU → product, variant or unit' })
  lookup(@Query('code') code: string) {
    return this.codes.lookup(code ?? '');
  }

  @Put('products/:id/barcode')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  setProductBarcode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBarcodeDto,
  ) {
    return this.codes.setBarcode('product', id, dto.barcode);
  }

  @Post('products/:id/barcode/generate')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  generateProductBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return this.codes.generate('product', id);
  }

  @Put('product-variants/:id/barcode')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  setVariantBarcode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBarcodeDto,
  ) {
    return this.codes.setBarcode('variant', id, dto.barcode);
  }

  @Post('product-variants/:id/barcode/generate')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  generateVariantBarcode(@Param('id', ParseUUIDPipe) id: string) {
    return this.codes.generate('variant', id);
  }

  @Get('products/:id/units')
  @CheckPolicies(read)
  units(@Param('id', ParseUUIDPipe) id: string) {
    return this.codes.units(id);
  }

  @Put('products/:id/base-unit')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  setBaseUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BaseUnitDto,
  ) {
    return this.codes.setBaseUnit(id, dto.base_unit);
  }

  @Post('products/:id/units')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  addUnit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UnitDto) {
    return this.codes.addUnit(id, dto);
  }

  @Patch('products/:id/units/:unitId')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: UnitDto,
  ) {
    return this.codes.updateUnit(id, unitId, dto);
  }

  @Delete('products/:id/units/:unitId')
  @CheckPolicies({ action: Action.Update, subject: 'products' })
  removeUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.codes.removeUnit(id, unitId);
  }

  // ---------- reorder ----------
  @Get('inventory-alerts/reorder')
  @CheckPolicies(read)
  alerts(@Query('locationId') locationId?: string) {
    return this.reorder.alerts(locationId || undefined);
  }

  @Get('inventory-alerts/reorder/summary')
  @CheckPolicies(read)
  alertCounts() {
    return this.reorder.counts();
  }

  @Post('inventory-alerts/reorder/purchase-order')
  @CheckPolicies({ action: Action.Create, subject: 'products' })
  @ApiOperation({
    summary: 'Draft purchase order from selected low-stock items',
  })
  draftPo(@GetCurrentUser() u: CurrentUser, @Body() dto: ReorderPoDto) {
    return this.reorder.draftPurchaseOrder(u.id, dto);
  }
}
