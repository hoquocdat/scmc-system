import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

interface KpiCardsProps {
  items: Kpi[];
  isLoading?: boolean;
}

/** Row of headline figures above a report. */
export function KpiCards({ items, isLoading }: KpiCardsProps) {
  const cards = isLoading && items.length === 0 ? Array.from({ length: 4 }, () => null) : items;
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((kpi, i) => (
        <Card key={kpi?.label ?? i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpi ? kpi.label : <Skeleton className="h-4 w-24" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpi ? (
              <>
                <div className="text-xl font-semibold tabular-nums sm:text-2xl">{kpi.value}</div>
                {kpi.hint && <p className="text-xs text-muted-foreground">{kpi.hint}</p>}
              </>
            ) : (
              <Skeleton className="h-7 w-32" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
