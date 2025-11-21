import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  IsDateString,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  full_name: string;

  @IsString()
  @MinLength(1)
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email address is invalid' })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  id_number?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  birthday?: string;

  @IsOptional()
  @IsString()
  salesperson_id?: string;
}
