import { IsString } from 'class-validator';

export class AssignEmployeeDto {
  @IsString()
  employee_id: string;
}
