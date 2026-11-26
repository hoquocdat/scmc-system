import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackageX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { stockOpsApi } from '@/lib/api/stock-operations';
import { usePermissions } from '@/hooks/usePermissions';

/** Dashboard card: low-stock items per branch, linking to the reorder list. */
export function ReorderAlertCard() {
  const { can } = usePermissions();
  const { data } = useQuery({ queryKey: ['reorder-alerts', 'summary'], queryFn: stockOpsApi.reorderSummary, enabled: can('inventory', 'read'), refetchInterval: 120_000 });
  if (!data) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Sắp hết hàng</CardTitle>
        <PackageX className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Link to="/inventory/reorder-alerts" className="text-2xl font-bold tabular-nums hover:underline">{data.total}</Link>
        <p className="text-xs text-muted-foreground">{data.locations.map((l) => `${l.location_name}: ${l.count}`).join(' · ') || 'Không có mặt hàng nào'}</p>
      </CardContent>
    </Card>
  );
}
