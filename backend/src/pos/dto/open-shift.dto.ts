import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Opens a shift for the calling user at a branch (store). */
export class OpenShiftDto {
  @ApiProperty({
    description:
      'Branch (store) UUID; the selling location is the store default warehouse',
  })
  @IsUUID()
  @IsNotEmpty()
  store_id: string;

  @ApiProperty({
    description: 'Cash declared in the drawer at opening (VND)',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  opening_cash: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
