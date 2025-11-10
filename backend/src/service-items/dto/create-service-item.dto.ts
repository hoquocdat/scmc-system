import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';

export class CreateServiceItemDto {
  @IsNotEmpty()
  @IsString()
  service_order_id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(['pending', 'confirmed', 'in_progress', 'waiting_parts', 'waiting_approval', 'quality_check', 'completed'])
  status: string;

  @IsOptional()
  @IsNumber()
  labor_cost?: number;

  @IsOptional()
  @IsNumber()
  hours_worked?: number;

  @IsOptional()
  @IsString()
  assigned_employee_id?: string;
}
