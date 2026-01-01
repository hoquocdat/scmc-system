import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoyaltyAdminService } from './loyalty-admin.service';
import {
  CreateTierDto,
  UpdateTierDto,
  CreateRuleVersionDto,
  LoyaltyMemberQueryDto,
  AdjustPointsDto,
} from './dto';

@Controller('admin/loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyAdminController {
  constructor(private readonly adminService: LoyaltyAdminService) {}

  /**
   * Get loyalty program statistics
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  /**
   * List all loyalty members
   */
  @Get('members')
  async getMembers(@Query() query: LoyaltyMemberQueryDto) {
    return this.adminService.getMembers(query);
  }

  /**
   * Get tier change history for a customer
   */
  @Get('members/:customerId/tier-history')
  async getTierHistory(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.adminService.getTierHistory(customerId);
  }

  /**
   * Manually adjust customer points
   */
  @Post('members/:customerId/adjust-points')
  async adjustPoints(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: Omit<AdjustPointsDto, 'customerId'>,
    @Request() req: any,
  ) {
    return this.adminService.adjustPoints({
      ...body,
      customerId,
      createdBy: req.user?.id,
    });
  }

  // Tier Management

  /**
   * Create a new tier
   */
  @Post('tiers')
  async createTier(@Body() dto: CreateTierDto) {
    return this.adminService.createTier(dto);
  }

  /**
   * Update a tier
   */
  @Patch('tiers/:id')
  async updateTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTierDto,
  ) {
    return this.adminService.updateTier(id, dto);
  }

  /**
   * Delete a tier
   */
  @Delete('tiers/:id')
  async deleteTier(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteTier(id);
  }

  // Rule Version Management

  /**
   * Get all rule versions
   */
  @Get('rules')
  async getRuleVersions() {
    return this.adminService.getRuleVersions();
  }

  /**
   * Create a new rule version
   */
  @Post('rules')
  async createRuleVersion(
    @Body() dto: CreateRuleVersionDto,
    @Request() req: any,
  ) {
    return this.adminService.createRuleVersion(dto, req.user?.id);
  }

  /**
   * Activate a specific rule version
   */
  @Post('rules/:id/activate')
  async activateRuleVersion(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.activateRuleVersion(id);
  }
}
