import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export const QR_PROVIDERS = ['vietqr', 'momo', 'zalopay', 'vnpay'] as const;

export class CreateQrRequestDto {
  @ApiProperty() @IsUUID() store_id: string;
  @ApiProperty({ enum: QR_PROVIDERS })
  @IsIn(QR_PROVIDERS)
  provider: (typeof QR_PROVIDERS)[number];
  @ApiProperty() @IsNumber() @Min(1000) amount: number;
  @ApiPropertyOptional({
    description: 'Cart idempotency key; the request can only pay that cart',
  })
  @IsOptional()
  @IsUUID()
  client_request_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() pos_session_id?: string;
}

export class SaveQrSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_enabled?: boolean;
  @ApiPropertyOptional({
    description:
      'Non-secret fields (bank_bin, account_number, account_name, partner_code, app_id, tmn_code, sandbox, expiry_minutes)',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
  @ApiPropertyOptional({
    description: 'Write-only secrets; empty values keep the stored ones',
  })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cash_account_id?:
    | string
    | null;
}
