import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SalaryConfigService } from './salary-config.service';
import { CreateSalaryConfigDto } from './dto/create-salary-config.dto';
import { UpdateSalaryConfigDto } from './dto/update-salary-config.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetCurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('salary-configs')
@ApiBearerAuth()
@Controller('salary-configs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'finance')
export class SalaryConfigController {
  constructor(private readonly salaryConfigService: SalaryConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get all salary configurations' })
  @ApiResponse({ status: 200, description: 'List of salary configs' })
  async findAll() {
    return this.salaryConfigService.findAll();
  }

  @Get('employees-without-config')
  @ApiOperation({ summary: 'Get employees without salary configuration' })
  @ApiResponse({ status: 200, description: 'List of employees' })
  async getEmployeesWithoutConfig() {
    return this.salaryConfigService.getEmployeesWithoutConfig();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get salary configuration by employee ID' })
  @ApiResponse({ status: 200, description: 'Salary config found' })
  @ApiResponse({ status: 404, description: 'Salary config not found' })
  async findByEmployee(@Param('employeeId') employeeId: string) {
    return this.salaryConfigService.findByEmployee(employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get salary configuration by ID' })
  @ApiResponse({ status: 200, description: 'Salary config found' })
  @ApiResponse({ status: 404, description: 'Salary config not found' })
  async findOne(@Param('id') id: string) {
    return this.salaryConfigService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create salary configuration for an employee' })
  @ApiResponse({ status: 201, description: 'Salary config created' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Salary config already exists' })
  async create(
    @Body() dto: CreateSalaryConfigDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.salaryConfigService.create(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update salary configuration' })
  @ApiResponse({ status: 200, description: 'Salary config updated' })
  @ApiResponse({ status: 404, description: 'Salary config not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryConfigDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.salaryConfigService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete salary configuration' })
  @ApiResponse({ status: 200, description: 'Salary config deleted' })
  @ApiResponse({ status: 404, description: 'Salary config not found' })
  async remove(@Param('id') id: string) {
    return this.salaryConfigService.remove(id);
  }
}
