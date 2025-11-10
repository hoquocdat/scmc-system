import { Module } from '@nestjs/common';
import { ServicePartsService } from './service-parts.service';
import { ServicePartsController } from './service-parts.controller';

@Module({
  controllers: [ServicePartsController],
  providers: [ServicePartsService],
})
export class ServicePartsModule {}
