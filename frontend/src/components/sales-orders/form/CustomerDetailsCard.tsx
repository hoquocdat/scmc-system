import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { customersApi } from '@/lib/api/customers';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/api/sales';

interface CustomerDetailsCardProps {
  customerId: string;
}

export function CustomerDetailsCard({ customerId }: CustomerDetailsCardProps) {
  // Fetch customer receivables
  const { data: receivablesData, isLoading: isLoadingReceivables } = useQuery({
    queryKey: ['customer-receivables', customerId],
    queryFn: () => customersApi.getReceivables(customerId),
    enabled: !!customerId,
  });

  // Fetch customer orders (last 5)
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: () => customersApi.getOrders(customerId, { page: 1, limit: 5 }),
    enabled: !!customerId,
  });

  const isLoading = isLoadingReceivables || isLoadingOrders;
  const summary = receivablesData?.summary;
  const orders = ordersData?.data || [];
  const totalOrders = ordersData?.pagination?.total || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Thông tin khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Thông tin khách hàng</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Receivables Summary */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Công nợ</span>
            {summary && summary.total_balance > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Còn nợ
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3" />
                Không nợ
              </Badge>
            )}
          </div>
          {summary && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Tổng mua</p>
                <p className="font-medium">{formatCurrency(summary.total_original)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Đã thanh toán</p>
                <p className="font-medium text-green-600">{formatCurrency(summary.total_paid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Còn nợ</p>
                <p className={`font-medium ${summary.total_balance > 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(summary.total_balance)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Đơn hàng gần đây</span>
            {totalOrders > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalOrders} đơn
              </span>
            )}
          </div>
          {orders.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/sales/orders/${order.id}`}
                  className="block rounded-lg border p-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{order.order_number}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <Badge
                      variant={
                        order.payment_status === 'paid'
                          ? 'default'
                          : order.payment_status === 'partial'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="text-xs"
                    >
                      {PAYMENT_STATUS_LABELS[order.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || order.payment_status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(order.created_at)}
                    </div>
                    <span className="font-medium text-foreground">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-xs">
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Khách hàng chưa có đơn hàng nào
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
