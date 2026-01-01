import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';
import { CalculateRedemptionDto } from './dto';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  /**
   * Get customer loyalty information
   */
  @Get('customer/:customerId')
  async getCustomerLoyalty(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.loyaltyService.getCustomerLoyalty(customerId);
  }

  /**
   * Get customer transaction history
   */
  @Get('customer/:customerId/history')
  async getTransactionHistory(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loyaltyService.getTransactionHistory(
      customerId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Calculate redemption preview for checkout
   */
  @Post('calculate-redemption')
  async calculateRedemption(@Body() dto: CalculateRedemptionDto) {
    return this.loyaltyService.calculateRedemption(dto);
  }

  /**
   * Get all active tiers
   */
  @Get('tiers')
  async getTiers() {
    return this.loyaltyService.getTiers();
  }

  /**
   * Get active loyalty rules
   */
  @Get('rules')
  async getActiveRules() {
    return this.loyaltyService.getActiveRules();
  }
}
