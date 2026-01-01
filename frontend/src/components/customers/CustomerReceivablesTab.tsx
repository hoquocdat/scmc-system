import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ExternalLink, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { customersApi } from '@/lib/api/customers';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { RecordReceivablePaymentDialog } from './RecordReceivablePaymentDialog';

interface CustomerReceivablesTabProps {
  customerId: string;
}

export function CustomerReceivablesTab({ customerId }: CustomerReceivablesTabProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-receivables', customerId],
    queryFn: () => customersApi.getReceivables(customerId),
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const summary = data?.summary;
  const receivables = data?.receivables || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng mua hàng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary?.total_original || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.total_paid || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Còn nợ
              {summary && summary.total_balance > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Còn nợ
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Hết nợ
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={`text-2xl font-bold ${(summary?.total_balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(summary?.total_balance || 0)}
            </p>
            {summary && summary.total_balance > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Ghi nhận thanh toán
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receivables Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết công nợ</CardTitle>
        </CardHeader>
        <CardContent>
          {receivables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Khách hàng chưa có công nợ nào
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Đơn hàng</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Giá trị đơn</TableHead>
                  <TableHead className="text-right">Đã thanh toán</TableHead>
                  <TableHead className="text-right">Còn nợ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((receivable) => (
                  <TableRow key={receivable.id}>
                    <TableCell>
                      <Link
                        to={`/sales/orders/${receivable.sales_order_id}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {receivable.sales_orders?.order_number || '-'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      {receivable.sales_orders?.created_at
                        ? formatDateTime(receivable.sales_orders.created_at)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(receivable.original_amount)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(receivable.paid_amount)}
                    </TableCell>
                    <TableCell className={`text-right ${receivable.balance > 0 ? 'text-red-600 font-medium' : ''}`}>
                      {formatCurrency(receivable.balance)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          receivable.status === 'paid'
                            ? 'default'
                            : receivable.status === 'partial'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {receivable.status === 'paid'
                          ? 'Đã thanh toán'
                          : receivable.status === 'partial'
                          ? 'Thanh toán một phần'
                          : 'Chưa thanh toán'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <RecordReceivablePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        customerId={customerId}
        receivables={receivables}
        totalBalance={summary?.total_balance || 0}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
