import { Module } from '@nestjs/common';
import { SalaryConfigController } from './salary-config.controller';
import { SalaryConfigService } from './salary-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalaryConfigController],
  providers: [SalaryConfigService],
  exports: [SalaryConfigService],
})
export class SalaryConfigModule {}
