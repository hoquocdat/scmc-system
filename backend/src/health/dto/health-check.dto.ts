import { ApiProperty } from '@nestjs/swagger';

class HealthCheckItemDto {
  @ApiProperty({
    description: 'Status of the health check item',
    enum: ['up', 'down', 'unknown'],
    example: 'up',
  })
  status: 'up' | 'down' | 'unknown';

  @ApiProperty({
    description: 'Message describing the health check result',
    example: 'Database connection successful',
  })
  message: string;

  @ApiProperty({
    description: 'Response time in milliseconds',
    example: 15,
  })
  responseTime: number;
}

class HealthChecksDto {
  @ApiProperty({
    description: 'Database health check',
    type: HealthCheckItemDto,
  })
  database: HealthCheckItemDto;
}

export class HealthCheckDto {
  @ApiProperty({
    description: 'Overall health status',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status: 'ok' | 'error';

  @ApiProperty({
    description: 'Timestamp of the health check',
    example: '2024-01-10T12:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Application uptime in seconds',
    example: 3600.5,
  })
  uptime: number;

  @ApiProperty({
    description: 'Current environment',
    example: 'production',
    required: false,
  })
  environment?: string;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
    required: false,
  })
  version?: string;

  @ApiProperty({
    description: 'Individual health checks',
    type: HealthChecksDto,
  })
  checks: HealthChecksDto;

  @ApiProperty({
    description: 'Total response time in milliseconds',
    example: 20,
    required: false,
  })
  responseTime?: number;
}
