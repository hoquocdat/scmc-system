import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PassThrough, Writable } from 'stream';
import { REPORT_TIME_ZONE } from './report-scope';
import { ReportColumn, ReportResult } from './report-types';

/** Exports with more rows than this are refused (spec: report-export, "Large exports"). */
export const EXPORT_MAX_ROWS = 100_000;

export type ExportLang = 'vi' | 'en';

export interface ExportOptions {
  lang?: ExportLang;
  /** Display name of the user who exported; printed in the title block. */
  generatedBy?: string;
  /** Branch name for the title block (the scope only has the id). */
  storeName?: string;
  generatedAt?: Date;
}

const LABELS: Record<ExportLang, Record<string, string>> = {
  vi: {
    branch: 'Chi nhánh',
    allBranches: 'Tất cả chi nhánh',
    period: 'Kỳ báo cáo',
    generated: 'Xuất lúc',
    by: 'bởi',
    total: 'Tổng cộng',
  },
  en: {
    branch: 'Branch',
    allBranches: 'All branches',
    period: 'Period',
    generated: 'Generated',
    by: 'by',
    total: 'Total',
  },
};

const NUMBER_FORMATS: Record<string, string> = {
  integer: '#,##0',
  number: '#,##0.00',
  money: '#,##0',
  percent: '0.00%',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};

// Intl formatters are expensive to build; large CSV exports format tens of thousands of cells.
const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DATETIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** dd/mm/yyyy or "dd/mm/yyyy hh:mm" in the report time zone. */
function formatInTimeZone(d: Date, withTime: boolean): string {
  return (withTime ? DATETIME_FORMATTER : DATE_FORMATTER)
    .format(d)
    .replace(', ', ' ');
}

/** Text for a cell of unknown type (objects are serialised, never "[object Object]"). */
function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

/**
 * Turns a ReportResult into an Excel or CSV file. The same column
 * definitions drive the on-screen table, so the file shows exactly the
 * rows the user saw (all pages, up to EXPORT_MAX_ROWS).
 */
@Injectable()
export class ExportService {
  assertExportable(result: ReportResult): void {
    const total =
      typeof result.meta?.total === 'number'
        ? result.meta.total
        : result.rows.length;
    if (total > EXPORT_MAX_ROWS) {
      throw new PayloadTooLargeException(
        `Báo cáo có ${total.toLocaleString('vi-VN')} dòng, vượt quá giới hạn xuất ${EXPORT_MAX_ROWS.toLocaleString('vi-VN')} dòng. Vui lòng thu hẹp bộ lọc.`,
      );
    }
  }

  fileName(result: ReportResult, format: 'xlsx' | 'csv'): string {
    return `${result.report.replace(/[^a-z0-9.-]/gi, '_')}_${result.scope.from}_${result.scope.to}.${format}`;
  }

  /** Cell value for a column type: numbers stay numbers, dates stay dates. */
  cellValue(column: ReportColumn, raw: unknown): ExcelJS.CellValue {
    if (raw === null || raw === undefined) return null;
    switch (column.type) {
      case 'integer':
      case 'number':
      case 'money':
        return typeof raw === 'number' ? raw : Number(raw);
      case 'percent':
        return (typeof raw === 'number' ? raw : Number(raw)) / 100;
      case 'date':
      case 'datetime':
        return raw instanceof Date ? raw : new Date(raw as string);
      default:
        return toText(raw);
    }
  }

  /** Writes the xlsx to a stream (streaming writer, low memory for large exports). */
  async writeXlsx(
    result: ReportResult,
    out: Writable,
    opts: ExportOptions = {},
  ): Promise<void> {
    this.assertExportable(result);
    const lang = opts.lang ?? 'vi';
    const L = LABELS[lang];
    const generatedAt = opts.generatedAt ?? new Date();
    const headerRowIndex = 6;

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: out,
      useStyles: true,
      useSharedStrings: false,
    });
    const sheet = workbook.addWorksheet(result.title[lang].slice(0, 31), {
      views: [{ state: 'frozen', ySplit: headerRowIndex }],
    });
    sheet.columns = result.columns.map((c) => ({
      key: c.key,
      width: Math.max(12, Math.min(40, c.header[lang].length + 6)),
    }));

    // Title block
    const title = sheet.addRow([result.title[lang]]);
    title.font = { bold: true, size: 14 };
    title.commit();
    sheet
      .addRow([
        `${L.branch}: ${opts.storeName ?? (result.scope.storeId ? result.scope.storeId : L.allBranches)}`,
      ])
      .commit();
    sheet
      .addRow([
        `${L.period}: ${result.scope.from} → ${result.scope.to} (${REPORT_TIME_ZONE})`,
      ])
      .commit();
    sheet
      .addRow([
        `${L.generated}: ${formatInTimeZone(generatedAt, true)}${opts.generatedBy ? ` ${L.by} ${opts.generatedBy}` : ''}`,
      ])
      .commit();
    sheet.addRow([]).commit();

    // Header
    const header = sheet.addRow(result.columns.map((c) => c.header[lang]));
    header.font = { bold: true };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    header.commit();
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: {
        row: headerRowIndex + result.rows.length,
        column: result.columns.length,
      },
    };

    // Data
    for (const row of result.rows) {
      const excelRow = sheet.addRow(
        result.columns.map((c) => this.cellValue(c, row[c.key])),
      );
      result.columns.forEach((c, i) => {
        const fmt = NUMBER_FORMATS[c.type];
        if (fmt) excelRow.getCell(i + 1).numFmt = fmt;
      });
      excelRow.commit();
    }

    // Totals
    if (result.totals && Object.keys(result.totals).length > 0) {
      const values = result.columns.map((c, i) => {
        if (i === 0 && !(c.key in result.totals)) return L.total;
        return c.key in result.totals
          ? this.cellValue(c, (result.totals as Record<string, unknown>)[c.key])
          : null;
      });
      const totalsRow = sheet.addRow(values);
      totalsRow.font = { bold: true };
      result.columns.forEach((c, i) => {
        const fmt = NUMBER_FORMATS[c.type];
        if (fmt) totalsRow.getCell(i + 1).numFmt = fmt;
      });
      totalsRow.commit();
    }

    sheet.commit();
    await workbook.commit();
  }

  async toXlsxBuffer(
    result: ReportResult,
    opts: ExportOptions = {},
  ): Promise<Buffer> {
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      pass.on('data', (chunk: Buffer) => chunks.push(chunk));
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
    });
    await this.writeXlsx(result, pass, opts);
    return done;
  }

  /** UTF-8 CSV with BOM so Excel opens Vietnamese text correctly. */
  toCsv(result: ReportResult, opts: ExportOptions = {}): Buffer {
    this.assertExportable(result);
    const lang = opts.lang ?? 'vi';
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = v instanceof Date ? formatInTimeZone(v, true) : toText(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [result.columns.map((c) => escape(c.header[lang])).join(',')];
    for (const row of result.rows) {
      lines.push(
        result.columns
          .map((c) => escape(this.csvValue(c, row[c.key])))
          .join(','),
      );
    }
    if (result.totals && Object.keys(result.totals).length > 0) {
      lines.push(
        result.columns
          .map((c, i) => {
            if (i === 0 && !(c.key in result.totals))
              return escape(LABELS[lang].total);
            return c.key in result.totals
              ? escape(
                  this.csvValue(
                    c,
                    (result.totals as Record<string, unknown>)[c.key],
                  ),
                )
              : '';
          })
          .join(','),
      );
    }
    return Buffer.concat([
      Buffer.from('﻿', 'utf8'),
      Buffer.from(lines.join('\r\n') + '\r\n', 'utf8'),
    ]);
  }

  private csvValue(column: ReportColumn, raw: unknown): unknown {
    if (raw === null || raw === undefined) return '';
    if (column.type === 'date')
      return formatInTimeZone(
        raw instanceof Date ? raw : new Date(raw as string),
        false,
      );
    if (column.type === 'datetime')
      return formatInTimeZone(
        raw instanceof Date ? raw : new Date(raw as string),
        true,
      );
    return raw;
  }
}
