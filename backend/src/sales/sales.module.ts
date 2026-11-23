import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SalesPostingService } from './sales-posting.service';
import { PriceResolverService } from './pricing/price-resolver';

@Module({
  imports: [PrismaModule, LoyaltyModule],
  controllers: [SalesController],
  providers: [SalesService, SalesPostingService, PriceResolverService],
  exports: [SalesService, SalesPostingService, PriceResolverService],
})
export class SalesModule {}
