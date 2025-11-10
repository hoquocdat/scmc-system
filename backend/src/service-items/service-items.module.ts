import { Module } from '@nestjs/common';
import { ServiceItemsService } from './service-items.service';
import { ServiceItemsController } from './service-items.controller';

@Module({
  controllers: [ServiceItemsController],
  providers: [ServiceItemsService],
})
export class ServiceItemsModule {}
