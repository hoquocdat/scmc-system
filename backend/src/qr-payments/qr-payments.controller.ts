import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeController,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import {
  CreateQrRequestDto,
  QR_PROVIDERS,
  SaveQrSettingsDto,
} from './dto/qr-payments.dto';
import { CallbackInput } from './providers/provider';
import { QrPaymentsService } from './qr-payments.service';

/** QR payment requests and provider settings (staff). */
@ApiTags('qr-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('qr-payments')
export class QrPaymentsController {
  constructor(private readonly qr: QrPaymentsService) {}

  @Get('providers')
  @CheckPolicies({ action: Action.Create, subject: 'qr_payments' })
  providers(@Query('storeId', ParseUUIDPipe) storeId: string) {
    return this.qr.enabledProviders(storeId);
  }

  @Post('requests')
  @CheckPolicies({ action: Action.Create, subject: 'qr_payments' })
  create(@GetCurrentUser() u: CurrentUser, @Body() dto: CreateQrRequestDto) {
    return this.qr.create(u, dto);
  }

  @Get('requests/:id')
  @CheckPolicies({ action: Action.Create, subject: 'qr_payments' })
  @ApiOperation({
    summary: 'State of a request (expired automatically when its time is up)',
  })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.qr.get(id);
  }

  @Post('requests/:id/check')
  @CheckPolicies({ action: Action.Create, subject: 'qr_payments' })
  check(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.qr.check(u, id);
  }

  @Post('requests/:id/confirm')
  @CheckPolicies({ action: Action.Confirm, subject: 'qr_payments' })
  @ApiOperation({ summary: 'VietQR: staff confirm the transfer arrived' })
  confirm(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.qr.confirm(u, id);
  }

  @Post('requests/:id/cancel')
  @CheckPolicies({ action: Action.Create, subject: 'qr_payments' })
  cancel(
    @GetCurrentUser() u: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.qr.cancel(u, id);
  }

  @Get('settings')
  @CheckPolicies({ action: Action.Configure, subject: 'qr_payments' })
  settings(@Query('storeId', ParseUUIDPipe) storeId: string) {
    return this.qr.listSettings(storeId);
  }

  @Put('settings/:storeId/:provider')
  @CheckPolicies({ action: Action.Configure, subject: 'qr_payments' })
  save(
    @GetCurrentUser() u: CurrentUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('provider') provider: string,
    @Body() dto: SaveQrSettingsDto,
  ) {
    if (!(QR_PROVIDERS as readonly string[]).includes(provider))
      throw new Error('Unknown provider');
    return this.qr.saveSettings(
      u,
      storeId,
      provider as (typeof QR_PROVIDERS)[number],
      dto,
    );
  }
}

const input = (
  req: Request & { rawBody?: Buffer },
  body: unknown,
  query: unknown,
  headers: Record<string, string | undefined>,
): CallbackInput => ({
  body: (body ?? {}) as Record<string, unknown>,
  query: (query ?? {}) as Record<string, string>,
  headers,
  rawBody: req.rawBody?.toString('utf8'),
});

/** Public provider callbacks: no JWT, protected by signatures (design D2–D3). */
@ApiExcludeController()
@Controller('qr-payments/callbacks')
export class QrCallbacksController {
  constructor(private readonly qr: QrPaymentsService) {}

  private async send(
    res: Response,
    p: Promise<{ status: number; body?: unknown }>,
  ) {
    const r = await p;
    res.status(r.status);
    return r.body ?? '';
  }

  @Post('momo')
  momo(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, this.qr.callback('momo', input(req, body, {}, h)));
  }

  @Post('zalopay')
  zalopay(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, this.qr.callback('zalopay', input(req, body, {}, h)));
  }

  @Get('vnpay')
  vnpay(
    @Req() req: Request,
    @Query() q: unknown,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, this.qr.callback('vnpay', input(req, {}, q, h)));
  }

  @Post('bank/:storeId')
  bank(
    @Req() req: Request,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: unknown,
    @Headers() h: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      this.qr.bankWebhook(storeId, input(req, body, {}, h)),
    );
  }
}
