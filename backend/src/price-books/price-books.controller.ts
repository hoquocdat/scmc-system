import {
  BadRequestException,
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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, GetCurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Action, CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PoliciesGuard } from '../casl/policies.guard';
import { assertCanApplyPriceBook } from '../sales/pricing/price-book-access';
import { CustomerGroupsService } from './customer-groups.service';
import {
  ApplicableBooksQueryDto,
  BulkAddEntriesDto,
  CreateCustomerGroupDto,
  CreatePriceBookDto,
  EntryQueryDto,
  EntryRuleDto,
  QuoteDto,
  SetCustomerGroupsDto,
  UpdateCustomerGroupDto,
  UpdatePriceBookDto,
  UpsertEntryDto,
} from './dto/price-books.dto';
import { PriceBooksService } from './price-books.service';
import { PricingService } from './pricing.service';

const read = { action: Action.Read, subject: 'price_books' } as const;

/** Price books (bảng giá) and their entries. */
@ApiTags('price-books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('price-books')
export class PriceBooksController {
  constructor(private readonly books: PriceBooksService) {}

  @Get()
  @CheckPolicies(read)
  list() {
    return this.books.list();
  }

  @Get(':id')
  @CheckPolicies(read)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.get(id);
  }

  @Post()
  @CheckPolicies({ action: Action.Create, subject: 'price_books' })
  create(@GetCurrentUser() user: CurrentUser, @Body() dto: CreatePriceBookDto) {
    return this.books.create(user.id, dto);
  }

  @Patch(':id')
  @CheckPolicies({ action: Action.Update, subject: 'price_books' })
  update(
    @GetCurrentUser() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceBookDto,
  ) {
    return this.books.update(user.id, id, dto);
  }

  @Delete(':id')
  @CheckPolicies({ action: Action.Delete, subject: 'price_books' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.remove(id);
  }

  @Get(':id/entries')
  @CheckPolicies(read)
  @ApiOperation({ summary: 'Entries with base price and resulting price' })
  entries(@Param('id', ParseUUIDPipe) id: string, @Query() q: EntryQueryDto) {
    return this.books.entries(id, q);
  }

  @Put(':id/entries')
  @CheckPolicies({ action: Action.Update, subject: 'price_books' })
  @ApiOperation({
    summary: 'Create or replace the entry of one product or variant',
  })
  upsertEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertEntryDto,
  ) {
    return this.books.upsertEntry(id, dto);
  }

  @Post(':id/entries/bulk')
  @CheckPolicies({ action: Action.Update, subject: 'price_books' })
  @ApiOperation({
    summary: 'Add products, a category or a brand with one rule',
  })
  bulkAdd(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkAddEntriesDto,
  ) {
    return this.books.bulkAdd(id, dto);
  }

  @Patch(':id/entries/:entryId')
  @CheckPolicies({ action: Action.Update, subject: 'price_books' })
  updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: EntryRuleDto,
  ) {
    return this.books.updateEntry(id, entryId, dto);
  }

  @Delete(':id/entries/:entryId')
  @CheckPolicies({ action: Action.Update, subject: 'price_books' })
  removeEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.books.removeEntry(id, entryId);
  }

  @Get(':id/export')
  @CheckPolicies(read)
  async export(@Param('id', ParseUUIDPipe) id: string) {
    const { buffer, fileName } = await this.books.exportXlsx(id);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Post(':id/import')
  @CheckPolicies({ action: Action.Update, subject: 'price_books' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  import(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Chưa chọn tệp');
    return this.books.importXlsx(id, file.buffer);
  }
}

/** Price quote and applicable books for the sale screens. */
@ApiTags('pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly casl: CaslAbilityFactory,
  ) {}

  @Post('quote')
  @CheckPolicies(read)
  async quote(@GetCurrentUser() user: CurrentUser, @Body() dto: QuoteDto) {
    if (dto.price_book_id) await assertCanApplyPriceBook(this.casl, user.id);
    return this.pricing.quote(dto);
  }

  @Get('applicable-books')
  @CheckPolicies(read)
  applicableBooks(@Query() q: ApplicableBooksQueryDto) {
    return this.pricing.applicableBooks(q);
  }
}

/** Customer groups and memberships. */
@ApiTags('customer-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class CustomerGroupsController {
  constructor(private readonly groups: CustomerGroupsService) {}

  @Get('customer-groups')
  @CheckPolicies({ action: Action.Read, subject: 'customer_groups' })
  list() {
    return this.groups.list();
  }

  @Post('customer-groups')
  @CheckPolicies({ action: Action.Create, subject: 'customer_groups' })
  create(
    @GetCurrentUser() user: CurrentUser,
    @Body() dto: CreateCustomerGroupDto,
  ) {
    return this.groups.create(user.id, dto);
  }

  @Patch('customer-groups/:id')
  @CheckPolicies({ action: Action.Update, subject: 'customer_groups' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerGroupDto,
  ) {
    return this.groups.update(id, dto);
  }

  @Delete('customer-groups/:id')
  @CheckPolicies({ action: Action.Delete, subject: 'customer_groups' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.remove(id);
  }

  @Get('customers/:id/groups')
  @CheckPolicies({ action: Action.Read, subject: 'customer_groups' })
  groupsOf(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.groupsOf(id);
  }

  @Put('customers/:id/groups')
  @CheckPolicies({ action: Action.Update, subject: 'customer_groups' })
  setGroupsOf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomerGroupsDto,
  ) {
    return this.groups.setGroupsOf(id, dto.group_ids);
  }
}
