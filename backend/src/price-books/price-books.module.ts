import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesModule } from '../sales/sales.module';
import { CustomerGroupsService } from './customer-groups.service';
import {
  CustomerGroupsController,
  PriceBooksController,
  PricingController,
} from './price-books.controller';
import { PriceBooksService } from './price-books.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [PrismaModule, CaslModule, SalesModule],
  controllers: [
    PriceBooksController,
    PricingController,
    CustomerGroupsController,
  ],
  providers: [PriceBooksService, PricingService, CustomerGroupsService],
  exports: [CustomerGroupsService],
})
export class PriceBooksModule {}
