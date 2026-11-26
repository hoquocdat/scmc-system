import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { PassThrough } from 'stream';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { Action, CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PrismaService } from '../prisma/prisma.service';
import { ExportService, ExportLang } from './export.service';
import { ReportResult } from './report-types';

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv; charset=utf-8';

/** Shape of req.user as set by JwtStrategy.validate (fullName) or tests (full_name). */
interface AuthenticatedUser {
  id: string;
  fullName?: string;
  full_name?: string;
  email?: string | null;
}

type ReportRequest = Request & { user?: AuthenticatedUser };

/** Namespace for deterministic report ids in activity_logs.entity_id (a UUID column). */
const REPORT_ENTITY_NAMESPACE = '6f9c1a52-3b0e-4d0a-9c1e-5b7a2d4e8f10';

/** RFC 4122 version-5 UUID (SHA-1, name-based) so every export of one report shares an entity id. */
export function reportEntityId(report: string): string {
  const ns = Buffer.from(REPORT_ENTITY_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(report, 'utf8')]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const queryString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Turns any report endpoint into a file download when `format=xlsx|csv`.
 * Requires reports:export on top of the report's own permission (checked by
 * PoliciesGuard), writes an activity-log entry, and streams the file.
 */
@Injectable()
export class ReportExportInterceptor implements NestInterceptor {
  constructor(
    private readonly exporter: ExportService,
    private readonly casl: CaslAbilityFactory,
    private readonly activity: ActivityLogsService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<ReportRequest>();
    const query = (req.query ?? {}) as Record<string, unknown>;
    const format = queryString(query.format);
    if (!format || format === 'json') {
      return next.handle();
    }
    if (format !== 'xlsx' && format !== 'csv') {
      throw new BadRequestException('format must be json, xlsx or csv');
    }

    const user = req.user;
    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }
    const ability = await this.casl.createForUser(user.id);
    if (!ability.can(Action.Export, 'reports')) {
      throw new ForbiddenException(
        "You don't have permission to export reports",
      );
    }

    return next.handle().pipe(
      mergeMap(async (result: ReportResult) => {
        if (
          !result ||
          !Array.isArray(result.columns) ||
          !Array.isArray(result.rows)
        ) {
          throw new BadRequestException('This endpoint cannot be exported');
        }
        this.exporter.assertExportable(result);

        const storeName = result.scope?.storeId
          ? (
              await this.prisma.stores.findUnique({
                where: { id: result.scope.storeId },
                select: { name: true },
              })
            )?.name
          : undefined;
        const lang: ExportLang = queryString(query.lang) === 'en' ? 'en' : 'vi';
        const opts = {
          lang,
          generatedBy: user.fullName ?? user.full_name ?? user.email ?? user.id,
          storeName,
        };
        const fileName = this.exporter.fileName(result, format);

        await this.activity.logActivity({
          userId: user.id,
          entityType: 'report',
          entityId: reportEntityId(result.report),
          action: 'export',
          newValues: {
            report: result.report,
            format,
            filters: query,
            rows: result.rows.length,
            fileName,
          },
          ipAddress: req.ip,
          userAgent: queryString(req.headers?.['user-agent']),
        });

        const res = http.getResponse<Response>();
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
        if (format === 'csv') {
          res.setHeader('Content-Type', CSV_MIME);
          return new StreamableFile(this.exporter.toCsv(result, opts));
        }
        res.setHeader('Content-Type', XLSX_MIME);
        const stream = new PassThrough();
        this.exporter
          .writeXlsx(result, stream, opts)
          .catch((err: unknown) =>
            stream.destroy(
              err instanceof Error
                ? err
                : new Error(
                    typeof err === 'string' ? err : JSON.stringify(err),
                  ),
            ),
          );
        return new StreamableFile(stream);
      }),
    );
  }
}
