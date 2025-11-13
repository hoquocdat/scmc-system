import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({
    description: 'User ID to assign roles to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Array of role IDs to assign (can be empty to remove all roles)',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds: string[];
}
