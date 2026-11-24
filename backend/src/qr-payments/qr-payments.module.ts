import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  QrCallbacksController,
  QrPaymentsController,
} from './qr-payments.controller';
import { QrPaymentsService } from './qr-payments.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [QrPaymentsController, QrCallbacksController],
  providers: [QrPaymentsService],
  exports: [QrPaymentsService],
})
export class QrPaymentsModule {}
