import { Module } from '@nestjs/common';
import { StockLocationsController } from './stock-locations.controller';
import { StockLocationsService } from './stock-locations.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StockLocationsController],
  providers: [StockLocationsService],
  exports: [StockLocationsService],
})
export class StockLocationsModule {}
