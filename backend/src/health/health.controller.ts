import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckDto } from './dto/health-check.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the health status of the application including database connectivity'
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    type: HealthCheckDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Application is unhealthy',
  })
  async check(): Promise<HealthCheckDto> {
    return await this.healthService.check();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Checks if the application is ready to accept traffic'
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  async ready(): Promise<{ status: string; ready: boolean }> {
    const health = await this.healthService.check();

    if (health.status === 'ok' && health.checks.database.status === 'up') {
      return { status: 'ready', ready: true };
    }

    throw new Error('Application not ready');
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Checks if the application is running'
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  live(): { status: string; alive: boolean } {
    return { status: 'alive', alive: true };
  }
}
