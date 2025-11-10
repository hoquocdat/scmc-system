import { IsUUID, IsNumber, IsEnum, IsBoolean, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
}

export class CreatePaymentDto {
  @IsUUID('all')
  service_order_id: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsBoolean()
  is_deposit: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
