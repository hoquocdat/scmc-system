import { Module } from '@nestjs/common';
import { AttributeDefinitionsService } from './attribute-definitions.service';
import { AttributeDefinitionsController } from './attribute-definitions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttributeDefinitionsController],
  providers: [AttributeDefinitionsService],
  exports: [AttributeDefinitionsService],
})
export class AttributeDefinitionsModule {}
