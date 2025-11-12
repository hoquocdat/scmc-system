import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum InputType {
  SELECT = 'select',
  COLOR = 'color',
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  MULTISELECT = 'multiselect',
}

export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
}

export class AttributeOptionDto {
  @ApiProperty({ description: 'Option value', example: 'red' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ description: 'Option label', example: 'Đỏ' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ description: 'Color code for color type', example: '#FF0000' })
  @IsString()
  @IsOptional()
  color_code?: string;
}

export class CreateAttributeDefinitionDto {
  @ApiProperty({ description: 'Attribute name', example: 'Màu sắc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Attribute slug (unique identifier)', example: 'color' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ description: 'Attribute description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Input type for UI',
    enum: InputType,
    default: InputType.SELECT,
  })
  @IsEnum(InputType)
  @IsOptional()
  input_type?: InputType;

  @ApiPropertyOptional({
    description: 'Data type',
    enum: DataType,
    default: DataType.STRING,
  })
  @IsEnum(DataType)
  @IsOptional()
  data_type?: DataType;

  @ApiPropertyOptional({ description: 'Is this a variant attribute?', default: true })
  @IsBoolean()
  @IsOptional()
  is_variant_attribute?: boolean;

  @ApiPropertyOptional({ description: 'Is this filterable?', default: true })
  @IsBoolean()
  @IsOptional()
  is_filterable?: boolean;

  @ApiPropertyOptional({ description: 'Is this required?', default: false })
  @IsBoolean()
  @IsOptional()
  is_required?: boolean;

  @ApiPropertyOptional({
    description: 'Available options for select/multiselect',
    type: [AttributeOptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeOptionDto)
  @IsOptional()
  options?: AttributeOptionDto[];

  @ApiPropertyOptional({
    description: 'Validation rules',
    example: { min: 0, max: 100 },
  })
  @IsObject()
  @IsOptional()
  validation_rules?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsInt()
  @IsOptional()
  display_order?: number;

  @ApiPropertyOptional({ description: 'Icon name for UI' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ description: 'Help text for users' })
  @IsString()
  @IsOptional()
  help_text?: string;

  @ApiPropertyOptional({ description: 'Is active?', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
