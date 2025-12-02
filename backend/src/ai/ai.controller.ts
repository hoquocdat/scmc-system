import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService, GenerateTasksResponse } from './ai.service';

export class GenerateTasksDto {
  @IsString()
  customer_demand: string;

  @IsOptional()
  @IsString()
  bike_brand?: string;

  @IsOptional()
  @IsString()
  bike_model?: string;

  @IsOptional()
  @IsNumber()
  bike_year?: number;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-tasks')
  @ApiOperation({ summary: 'Generate service tasks from customer demand using AI' })
  @ApiResponse({ status: 200, description: 'Generated tasks' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateTasks(@Body() dto: GenerateTasksDto): Promise<GenerateTasksResponse> {
    console.log(dto)
    return this.aiService.generateServiceTasks(
      dto.customer_demand,
      {
        brand: dto.bike_brand,
        model: dto.bike_model,
        year: dto.bike_year,
      },
    );
  }
}
