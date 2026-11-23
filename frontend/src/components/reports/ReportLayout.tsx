import { useState, type ReactNode } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReportKey, ReportQuery } from '@/lib/api/reports';
import type { ReportFilters } from '@/hooks/useReportFilters';
import { ExportMenu } from './ExportMenu';
import { ReportFilterBadges } from './ReportFilterBadges';
import { ReportFilterSheet, type ReportFilterOptions } from './ReportFilterSheet';

interface ReportLayoutProps {
  title: string;
  description?: string;
  reportKey: ReportKey;
  filters: ReportFilters;
  query: ReportQuery;
  filterOptions: ReportFilterOptions;
  activeCount: number;
  onFiltersChange: (next: Partial<ReportFilters>) => void;
  onClearFilters: () => void;
  exportDisabled?: boolean;
  children: ReactNode;
}

/** Title, "Lọc" button, export menu, active filter badges, then the report body. */
export function ReportLayout(props: ReportLayoutProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const { title, description, reportKey, filters, query, filterOptions, activeCount, onFiltersChange, onClearFilters, exportDisabled, children } = props;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4" />
            Lọc
            {activeCount > 0 && <Badge variant="secondary" className="ml-1 px-1.5">{activeCount}</Badge>}
          </Button>
          <ExportMenu reportKey={reportKey} query={query} disabled={exportDisabled} />
        </div>
      </div>

      <ReportFilterBadges filters={filters} activeCount={activeCount} onChange={onFiltersChange} onClear={onClearFilters} />

      {children}

      <ReportFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        options={filterOptions}
        onApply={onFiltersChange}
        onClear={onClearFilters}
      />
    </div>
  );
}
