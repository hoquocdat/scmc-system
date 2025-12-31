import { Module } from '@nestjs/common';
import { SupplierReturnsService } from './supplier-returns.service';
import { SupplierReturnsController } from './supplier-returns.controller';

@Module({
  controllers: [SupplierReturnsController],
  providers: [SupplierReturnsService],
  exports: [SupplierReturnsService],
})
export class SupplierReturnsModule {}
