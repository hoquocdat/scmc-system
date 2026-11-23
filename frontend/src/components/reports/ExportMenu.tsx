import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { readBlobError, reportsApi, saveBlob, type ReportFormat, type ReportKey, type ReportQuery } from '@/lib/api/reports';

interface ExportMenuProps {
  reportKey: ReportKey;
  query: ReportQuery | Record<string, unknown>;
  disabled?: boolean;
}

/** Excel / CSV download of the current report with the current filters. */
export function ExportMenu({ reportKey, query, disabled }: ExportMenuProps) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  const run = async (format: ReportFormat) => {
    setBusy(format);
    try {
      const { blob, fileName } = await reportsApi.download(reportKey, query, format);
      saveBlob(blob, fileName);
      toast.success(`Đã xuất ${fileName}`);
    } catch (error) {
      toast.error(await readBlobError(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || busy !== null}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Xuất file
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run('xlsx')}>
          <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('csv')}>
          <FileText className="h-4 w-4" /> CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
