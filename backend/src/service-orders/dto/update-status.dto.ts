import { IsEnum } from 'class-validator';
import { ServiceStatus } from './create-service-order.dto';

export class UpdateStatusDto {
  @IsEnum(ServiceStatus)
  status: ServiceStatus;
}
