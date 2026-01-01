import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { loyaltyApi, TRANSACTION_TYPE_LABELS, formatPoints } from '@/lib/api/loyalty';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LoyaltyHistoryTableProps {
  customerId: string;
  limit?: number;
}

export function LoyaltyHistoryTable({ customerId, limit = 10 }: LoyaltyHistoryTableProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['loyaltyHistory', customerId, page, limit],
    queryFn: () => loyaltyApi.getTransactionHistory(customerId, { page, limit }),
    enabled: !!customerId,
  });

  if (!customerId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Chưa có lịch sử giao dịch điểm
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / limit);

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'earn':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'redeem':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'reverse':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'adjust':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'expire':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead className="text-right">Điểm</TableHead>
            <TableHead className="text-right">Số dư sau</TableHead>
            <TableHead>Ghi chú</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={getTransactionTypeColor(tx.transactionType)}>
                  {TRANSACTION_TYPE_LABELS[tx.transactionType] || tx.transactionType}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-medium',
                    tx.points > 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {tx.points > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {tx.points > 0 ? '+' : ''}
                  {formatPoints(tx.points)}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatPoints(tx.pointsBalanceAfter)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {tx.reason}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Trang {page} / {totalPages} ({data.total} giao dịch)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
