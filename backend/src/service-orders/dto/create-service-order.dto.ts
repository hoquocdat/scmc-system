import { IsString, IsUUID, IsOptional, IsEnum, IsNumber, Min, IsArray } from 'class-validator';

export enum ServiceStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  WAITING_PARTS = 'waiting_parts',
  WAITING_APPROVAL = 'waiting_approval',
  QUALITY_CHECK = 'quality_check',
  COMPLETED = 'completed',
  READY_FOR_PICKUP = 'ready_for_pickup',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PriorityLevel {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class CreateServiceOrderDto {
  @IsString()
  motorcycle_id: string;

  @IsString()
  customer_id: string;

  @IsOptional()
  @IsString()
  assigned_employee_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employee_ids?: string[];

  @IsEnum(PriorityLevel)
  priority: PriorityLevel;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  customer_demand?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage_in?: number;

  @IsOptional()
  @IsString()
  estimated_completion_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_cost?: number;
}
