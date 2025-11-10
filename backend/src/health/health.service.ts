import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthCheckDto } from './dto/health-check.dto';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async check(): Promise<HealthCheckDto> {
    const startTime = Date.now();
    const checks: HealthCheckDto['checks'] = {
      database: {
        status: 'unknown',
        message: '',
        responseTime: 0,
      },
    };

    // Check database connectivity
    try {
      const dbStartTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const dbEndTime = Date.now();

      checks.database = {
        status: 'up',
        message: 'Database connection successful',
        responseTime: dbEndTime - dbStartTime,
      };
    } catch (error) {
      checks.database = {
        status: 'down',
        message: `Database connection failed: ${error.message}`,
        responseTime: Date.now() - startTime,
      };

      // If database is down, return 503 Service Unavailable
      throw new HttpException(
        {
          status: 'error',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          checks,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const endTime = Date.now();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks,
      responseTime: endTime - startTime,
    };
  }
}
