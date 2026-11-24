import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReturnPreview } from '@/lib/api/sales-returns';
import { formatCurrency } from '@/lib/utils';

/** Amounts the server computed for the return or exchange. */
export function ReturnSummary({ preview, loading }: { preview?: ReturnPreview; loading?: boolean }) {
  if (!preview) return loading ? <Skeleton className="h-24 w-full" /> : null;
  const rows: [string, number, boolean?][] = [
    ['Giá trị hàng trả', preview.goods_amount],
    ...(preview.receivable_reduction > 0 ? [['Trừ vào công nợ của đơn', -preview.receivable_reduction] as [string, number]] : []),
    ...(preview.exchange_total > 0
      ? [
          ['Đơn đổi', preview.exchange_total] as [string, number],
          ['Trừ vào đơn đổi', -preview.exchange_applied] as [string, number],
        ]
      : []),
    ['Hoàn lại cho khách', preview.refund_after_exchange, true],
    ...(preview.customer_pays > 0 ? [['Khách trả thêm', preview.customer_pays, true] as [string, number, boolean]] : []),
  ];
  return (
    <div className="space-y-2">
      <dl className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
        {rows.map(([k, v, strong]) => (
          <div key={k} className={`flex justify-between ${strong ? 'font-semibold' : ''}`}>
            <dt>{k}</dt>
            <dd className="tabular-nums">{formatCurrency(v)}</dd>
          </div>
        ))}
        {(preview.points_reversed > 0 || preview.points_restored > 0) && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Điểm thưởng</dt>
            <dd>−{preview.points_reversed} thu hồi · +{preview.points_restored} hoàn</dd>
          </div>
        )}
      </dl>
      {preview.needs_approval && (
        <Alert variant={preview.can_approve ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Cần quản lý duyệt: {preview.approval_reasons.join('; ')}.{' '}
            {preview.can_approve ? 'Bạn có quyền duyệt; xác nhận sẽ ghi nhận bạn là người duyệt.' : 'Nhờ quản lý cửa hàng thực hiện phiếu này.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
