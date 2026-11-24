import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { CartService } from './cart.service';
import {
  CampaignInputDto,
  CartDto,
  CodesQueryDto,
  GenerateCodesDto,
  PromotionInputDto,
  UpdateCodeDto,
  VoucherCheckQueryDto,
} from './dto/promotions.dto';
import { PromotionsService } from './promotions.service';
import { VouchersService } from './vouchers.service';

/** Promotions (khuyến mãi). */
@ApiTags('promotions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @CheckPolicies({ action: Action.Read, subject: 'promotions' })
  list() {
    return this.promotions.list();
  }

  @Get(':id')
  @CheckPolicies({ action: Action.Read, subject: 'promotions' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.get(id);
  }

  @Post()
  @CheckPolicies({ action: Action.Create, subject: 'promotions' })
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: PromotionInputDto) {
    return this.promotions.create(user.id, dto);
  }

  @Patch(':id')
  @CheckPolicies({ action: Action.Update, subject: 'promotions' })
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PromotionInputDto,
  ) {
    return this.promotions.update(user.id, id, dto);
  }

  @Delete(':id')
  @CheckPolicies({ action: Action.Delete, subject: 'promotions' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.remove(id);
  }
}

/** Voucher campaigns and codes. */
@ApiTags('vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get('vouchers/check')
  @CheckPolicies({ action: Action.Read, subject: 'vouchers' })
  @ApiOperation({ summary: 'Whether a code is usable, and why not' })
  check(@Query() q: VoucherCheckQueryDto) {
    return this.vouchers.check(q);
  }

  @Get('voucher-campaigns')
  @CheckPolicies({ action: Action.Read, subject: 'vouchers' })
  list() {
    return this.vouchers.list();
  }

  @Get('voucher-campaigns/:id')
  @CheckPolicies({ action: Action.Read, subject: 'vouchers' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchers.get(id);
  }

  @Post('voucher-campaigns')
  @CheckPolicies({ action: Action.Create, subject: 'vouchers' })
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: CampaignInputDto) {
    return this.vouchers.create(user.id, dto);
  }

  @Patch('voucher-campaigns/:id')
  @CheckPolicies({ action: Action.Update, subject: 'vouchers' })
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CampaignInputDto,
  ) {
    return this.vouchers.update(user.id, id, dto);
  }

  @Delete('voucher-campaigns/:id')
  @CheckPolicies({ action: Action.Delete, subject: 'vouchers' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vouchers.remove(id);
  }

  @Post('voucher-campaigns/:id/codes')
  @CheckPolicies({ action: Action.Create, subject: 'vouchers' })
  @ApiOperation({
    summary: 'One given code, or a batch of random codes with a prefix',
  })
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateCodesDto,
  ) {
    return this.vouchers.generate(id, dto);
  }

  @Get('voucher-campaigns/:id/codes')
  @CheckPolicies({ action: Action.Read, subject: 'vouchers' })
  codes(@Param('id', ParseUUIDPipe) id: string, @Query() q: CodesQueryDto) {
    return this.vouchers.codes(id, q);
  }

  @Patch('voucher-campaigns/:id/codes/:codeId')
  @CheckPolicies({ action: Action.Update, subject: 'vouchers' })
  setCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Body() dto: UpdateCodeDto,
  ) {
    return this.vouchers.setCodeActive(id, codeId, dto.is_active);
  }

  @Get('voucher-campaigns/:id/export')
  @CheckPolicies({ action: Action.Read, subject: 'vouchers' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Param('id', ParseUUIDPipe) id: string) {
    const { csv, fileName } = await this.vouchers.exportCsv(id);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}

/** Full discount breakdown of a cart for POS and the sales-order form. */
@ApiTags('pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('pricing')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post('cart')
  @CheckPolicies({ action: Action.Read, subject: 'promotions' })
  @ApiOperation({
    summary:
      'Prices, promotions, voucher and totals of a cart, as checkout computes them',
  })
  price(@Body() dto: CartDto) {
    return this.cart.price(dto);
  }
}
