import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { ReportResult } from '@/lib/api/reports';
import { formatCurrency } from '@/lib/utils';

export interface ChartSpec {
  /** Row key for the x axis (e.g. "period" or "category"). */
  x: string;
  /** Row key plotted on the y axis. */
  y: string;
  label: string;
  kind?: 'bar' | 'line';
  money?: boolean;
  title?: string;
}

interface TrendChartProps {
  result?: ReportResult;
  spec: ChartSpec;
}

const compact = (v: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** One-series chart over the report rows, using the shadcn chart wrapper around recharts. */
export function TrendChart({ result, spec }: TrendChartProps) {
  if (!result || result.rows.length === 0) return null;
  const config: ChartConfig = { [spec.y]: { label: spec.label, color: 'var(--chart-1)' } };
  const data = result.rows.map((r) => ({ ...r, [spec.x]: String(r[spec.x]) }));
  const Chart = spec.kind === 'line' ? LineChart : BarChart;
  const formatter = (value: unknown) => (spec.money ? formatCurrency(Number(value)) : Number(value).toLocaleString('vi-VN'));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{spec.title ?? spec.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <Chart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={spec.x} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatter(value)} />} />
            {spec.kind === 'line' ? (
              <Line dataKey={spec.y} type="monotone" stroke={`var(--color-${spec.y})`} strokeWidth={2} dot={false} />
            ) : (
              <Bar dataKey={spec.y} fill={`var(--color-${spec.y})`} radius={4} />
            )}
          </Chart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
