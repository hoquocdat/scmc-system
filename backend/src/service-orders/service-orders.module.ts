import { Module } from '@nestjs/common';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';
import { StorageModule } from '../storage/storage.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [StorageModule, ActivityLogsModule],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
