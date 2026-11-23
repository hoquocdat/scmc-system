import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Business time zone: every report day, week and month boundary uses it. */
export const REPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Sales-order statuses that count as revenue (see specs/reporting/sales-reports). */
export const REVENUE_STATUSES = [
  'confirmed',
  'processing',
  'ready',
  'completed',
] as const;

export type ReportInterval = 'daily' | 'weekly' | 'monthly';

export interface ReportScopeInput {
  from?: string;
  to?: string;
  storeId?: string;
  /** daily | weekly | monthly; validated in the constructor. */
  interval?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "YYYY-MM-DD" of the given instant in the report time zone. */
export function toReportDate(instant: Date): string {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** UTC instant for midnight of a "YYYY-MM-DD" date in the report time zone. */
export function reportDateStart(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Validated reporting filters plus the SQL fragments every report shares, so
 * that the status rule, time zone, branch filter and period grouping are
 * defined once.
 */
export class ReportScope {
  /** Inclusive first day, "YYYY-MM-DD" in the report time zone. */
  readonly from: string;
  /** Inclusive last day, "YYYY-MM-DD" in the report time zone. */
  readonly to: string;
  /** UTC instant of the first day's midnight. */
  readonly start: Date;
  /** UTC instant of the midnight after the last day (exclusive bound). */
  readonly endExclusive: Date;
  readonly storeId?: string;
  readonly interval: ReportInterval;

  constructor(input: ReportScopeInput = {}, now: Date = new Date()) {
    const today = toReportDate(now);
    const monthStart = `${today.slice(0, 7)}-01`;

    const from = input.from ?? monthStart;
    const to = input.to ?? today;
    if (!DATE_RE.test(from) || Number.isNaN(reportDateStart(from).getTime())) {
      throw new BadRequestException(`Invalid "from" date: ${input.from}`);
    }
    if (!DATE_RE.test(to) || Number.isNaN(reportDateStart(to).getTime())) {
      throw new BadRequestException(`Invalid "to" date: ${input.to}`);
    }
    if (from > to) {
      throw new BadRequestException('"from" must not be after "to"');
    }
    if (
      input.storeId !== undefined &&
      input.storeId !== '' &&
      !UUID_RE.test(input.storeId)
    ) {
      throw new BadRequestException('Invalid storeId');
    }
    const interval = (input.interval ?? 'daily') as ReportInterval;
    if (!['daily', 'weekly', 'monthly'].includes(interval)) {
      throw new BadRequestException(
        'interval must be daily, weekly or monthly',
      );
    }

    this.from = from;
    this.to = to;
    this.start = reportDateStart(from);
    this.endExclusive = reportDateStart(addDays(to, 1));
    this.storeId = input.storeId || undefined;
    this.interval = interval;
  }

  // ---- SQL fragments -------------------------------------------------------

  /** `column >= start AND column < endExclusive` (index-friendly, no conversion on the column). */
  inRange(column: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`${column} >= ${this.start} AND ${column} < ${this.endExclusive}`;
  }

  /** `AND column = storeId` when a branch is selected, otherwise nothing. */
  storeFilter(column: Prisma.Sql): Prisma.Sql {
    return this.storeId
      ? Prisma.sql`AND ${column} = ${this.storeId}::uuid`
      : Prisma.empty;
  }

  /** `column IN (revenue statuses)`. */
  static revenueStatus(column: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`${column} IN (${Prisma.join([...REVENUE_STATUSES])})`;
  }

  /** The order's business date: order_date, else created_at. */
  static orderDate(alias = 'so'): Prisma.Sql {
    return Prisma.raw(`COALESCE(${alias}.order_date, ${alias}.created_at)`);
  }

  private get truncUnit(): string {
    return this.interval === 'daily'
      ? 'day'
      : this.interval === 'weekly'
        ? 'week'
        : 'month';
  }

  /** Period bucket key (text) for a timestamptz column, in the report time zone. */
  periodKey(column: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`to_char(date_trunc(${this.truncUnit}, (${column} AT TIME ZONE ${REPORT_TIME_ZONE})), ${this.periodFormat})`;
  }

  /** to_char format matching periodKey: YYYY-MM-DD, IYYY-IW or YYYY-MM. */
  get periodFormat(): string {
    return this.interval === 'daily'
      ? 'YYYY-MM-DD'
      : this.interval === 'weekly'
        ? 'IYYY-IW'
        : 'YYYY-MM';
  }

  /**
   * A relation `periods(period text)` with one row per bucket in the range,
   * including buckets with no data, for LEFT JOINs.
   */
  periodSeries(): Prisma.Sql {
    const step = `1 ${this.truncUnit}`;
    return Prisma.sql`(
      SELECT to_char(p, ${this.periodFormat}) AS period
      FROM generate_series(
        date_trunc(${this.truncUnit}, ${this.from}::date::timestamp),
        date_trunc(${this.truncUnit}, ${this.to}::date::timestamp),
        ${step}::interval
      ) AS p
    )`;
  }

  /** Plain object for API responses. */
  toJSON() {
    return {
      from: this.from,
      to: this.to,
      storeId: this.storeId ?? null,
      interval: this.interval,
      timeZone: REPORT_TIME_ZONE,
    };
  }
}
