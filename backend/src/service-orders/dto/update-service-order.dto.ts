import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceOrderDto } from './create-service-order.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ServiceStatus } from './create-service-order.dto';

export class UpdateServiceOrderDto extends PartialType(CreateServiceOrderDto) {
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}
