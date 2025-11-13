import { Module } from '@nestjs/common';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';
import { StorageModule } from '../storage/storage.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [StorageModule, ActivityLogsModule, CaslModule],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
