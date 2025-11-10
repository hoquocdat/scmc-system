import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { ActivityLog } from './activity-log.entity';

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async create(createActivityLogDto: CreateActivityLogDto): Promise<ActivityLog> {
    try {
      return await this.prisma.activity_logs.create({
        data: createActivityLogDto as any,
      }) as any;
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw new Error(error.message);
    }
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.activity_logs.findMany({
        where: {
          entity_type: entityType as any,
          entity_id: entityId,
        },
        include: {
          user_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.activity_logs.count({
        where: {
          entity_type: entityType as any,
          entity_id: entityId,
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findByUser(userId: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.activity_logs.findMany({
        where: { user_id: userId },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      this.prisma.activity_logs.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Helper method to log activity easily from other services
   */
  async logActivity(params: {
    userId?: string;
    entityType: string;
    entityId: string;
    action: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.create({
        user_id: params.userId,
        entity_type: params.entityType as any,
        entity_id: params.entityId,
        action: params.action as any,
        old_values: params.oldValues,
        new_values: params.newValues,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });
    } catch (error) {
      // Log error but don't throw to avoid breaking main operations
      console.error('Failed to log activity:', error);
    }
  }
}
