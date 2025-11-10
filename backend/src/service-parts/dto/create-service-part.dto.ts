import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateServicePartDto {
  @IsNotEmpty()
  @IsString()
  service_order_id: string;

  @IsNotEmpty()
  @IsString()
  part_id: string;

  @IsNotEmpty()
  @IsNumber()
  quantity_used: number;

  @IsNotEmpty()
  @IsNumber()
  unit_cost: number;
}
