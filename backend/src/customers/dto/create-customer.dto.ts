import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

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
}
