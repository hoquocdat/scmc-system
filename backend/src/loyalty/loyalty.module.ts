import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyAdminController } from './loyalty-admin.controller';
import { LoyaltyAdminService } from './loyalty-admin.service';

@Module({
  controllers: [LoyaltyController, LoyaltyAdminController],
  providers: [LoyaltyService, LoyaltyAdminService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
