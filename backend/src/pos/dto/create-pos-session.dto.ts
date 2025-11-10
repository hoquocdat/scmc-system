import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsNotEmpty, Min, IsString, IsOptional } from 'class-validator';

export class CreatePosSessionDto {
  @ApiProperty({ description: 'Location UUID for the POS session' })
  @IsUUID()
  @IsNotEmpty()
  location_id: string;

  @ApiProperty({ description: 'Cashier/Staff UUID for the session' })
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ description: 'Opening cash amount in drawer' })
  @IsNumber()
  @Min(0)
  opening_cash: number;

  @ApiPropertyOptional({ description: 'Session notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
