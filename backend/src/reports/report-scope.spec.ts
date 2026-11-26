import { BadRequestException } from '@nestjs/common';
import { ReportScope, reportDateStart, toReportDate } from './report-scope';

describe('ReportScope', () => {
  it('puts an early-morning Vietnam sale on its Vietnam date', () => {
    // 06:30 on 5 March in Vietnam is 23:30 on 4 March UTC
    const sale = new Date('2026-03-04T23:30:00Z');
    expect(toReportDate(sale)).toBe('2026-03-05');

    const scope = new ReportScope({ from: '2026-03-05', to: '2026-03-05' });
    expect(sale >= scope.start && sale < scope.endExclusive).toBe(true);

    const dayBefore = new ReportScope({ from: '2026-03-04', to: '2026-03-04' });
    expect(sale >= dayBefore.start && sale < dayBefore.endExclusive).toBe(
      false,
    );
  });

  it('includes the whole end date', () => {
    const scope = new ReportScope({ from: '2026-03-01', to: '2026-03-31' });
    const lateSale = new Date('2026-03-31T21:00:00+07:00');
    const nextDay = new Date('2026-04-01T00:00:00+07:00');
    expect(scope.start.toISOString()).toBe('2026-02-28T17:00:00.000Z');
    expect(scope.endExclusive.toISOString()).toBe('2026-03-31T17:00:00.000Z');
    expect(lateSale < scope.endExclusive).toBe(true);
    expect(nextDay < scope.endExclusive).toBe(false);
  });

  it('defaults to the current month in Vietnam time', () => {
    // 01:00 on 1 April in Vietnam is still 31 March UTC
    const now = new Date('2026-03-31T18:00:00Z');
    const scope = new ReportScope({}, now);
    expect(scope.from).toBe('2026-04-01');
    expect(scope.to).toBe('2026-04-01');
  });

  it('rejects malformed input', () => {
    expect(() => new ReportScope({ from: '2026-3-1' })).toThrow(
      BadRequestException,
    );
    expect(
      () => new ReportScope({ from: '2026-03-10', to: '2026-03-01' }),
    ).toThrow(BadRequestException);
    expect(() => new ReportScope({ storeId: 'not-a-uuid' })).toThrow(
      BadRequestException,
    );
    expect(() => new ReportScope({ interval: 'hourly' })).toThrow(
      BadRequestException,
    );
  });

  it('exposes period formats per interval', () => {
    expect(new ReportScope({ interval: 'daily' }).periodFormat).toBe(
      'YYYY-MM-DD',
    );
    expect(new ReportScope({ interval: 'weekly' }).periodFormat).toBe(
      'IYYY-IW',
    );
    expect(new ReportScope({ interval: 'monthly' }).periodFormat).toBe(
      'YYYY-MM',
    );
    expect(reportDateStart('2026-01-01').toISOString()).toBe(
      '2025-12-31T17:00:00.000Z',
    );
  });
});
