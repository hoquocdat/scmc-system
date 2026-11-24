import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { ReportExportInterceptor } from '../reports/report-export.interceptor';
import {
  LookupQueryDto,
  ReturnListQueryDto,
  ReturnRequestDto,
} from './dto/sales-returns.dto';
import { SalesReturnsService } from './sales-returns.service';

const read = { action: Action.Read, subject: 'sales_returns' } as const;
const create = { action: Action.Create, subject: 'sales_returns' } as const;

/** Sales returns and exchanges (trả hàng, đổi hàng). */
@ApiTags('sales-returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class SalesReturnsController {
  constructor(private readonly returns: SalesReturnsService) {}

  @Get('sales-returns')
  @UseInterceptors(ReportExportInterceptor)
  @ApiProduces(
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  )
  @CheckPolicies(read)
  @ApiOperation({
    summary: 'Returns in a period; format=xlsx|csv exports every matching row',
  })
  list(@Query() q: ReturnListQueryDto) {
    return this.returns.list(q, q.format === 'xlsx' || q.format === 'csv');
  }

  @Get('sales-returns/lookup')
  @CheckPolicies(read)
  @ApiOperation({ summary: 'Order by number or id with its returnable lines' })
  lookup(@Query() q: LookupQueryDto) {
    return this.returns.lookup(q.code);
  }

  @Post('sales-returns/preview')
  @CheckPolicies(create)
  @ApiOperation({
    summary: 'Amounts a return or exchange would produce, nothing written',
  })
  preview(@GetCurrentUser() user: CurrentUser, @Body() dto: ReturnRequestDto) {
    return this.returns.preview(user, dto);
  }

  @Post('sales-returns')
  @CheckPolicies(create)
  @ApiOperation({ summary: 'Post a return or an exchange' })
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: ReturnRequestDto) {
    return this.returns.create(user, dto);
  }

  @Get('sales-returns/:id')
  @CheckPolicies(read)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.returns.get(id);
  }

  @Get('customers/:id/credit')
  @CheckPolicies(read)
  @ApiOperation({ summary: 'Customer credit balance and movements' })
  credit(@Param('id', ParseUUIDPipe) id: string) {
    return this.returns.customerCredit(id);
  }
}
