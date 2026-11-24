import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesModule } from '../sales/sales.module';
import { CartService } from './cart.service';
import {
  CartController,
  PromotionsController,
  VouchersController,
} from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { VouchersService } from './vouchers.service';

@Module({
  imports: [PrismaModule, CaslModule, SalesModule],
  controllers: [PromotionsController, VouchersController, CartController],
  providers: [PromotionsService, VouchersService, CartService],
})
export class PromotionsModule {}
