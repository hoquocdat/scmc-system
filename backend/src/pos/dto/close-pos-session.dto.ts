import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsString, IsOptional } from 'class-validator';

export class ClosePosSessionDto {
  @ApiProperty({ description: 'Actual closing cash amount in drawer' })
  @IsNumber()
  @Min(0)
  closing_cash: number;

  @ApiPropertyOptional({ description: 'Closing notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
