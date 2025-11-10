import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSalesOrderDto } from './create-sales-order.dto';

// Omit items from update DTO - items should be updated separately
export class UpdateSalesOrderDto extends PartialType(
  OmitType(CreateSalesOrderDto, ['items'] as const),
) {}
