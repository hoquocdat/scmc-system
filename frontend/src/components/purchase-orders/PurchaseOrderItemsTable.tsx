import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { purchaseOrdersApi, type PurchaseOrderItem } from '@/lib/api/purchase-orders';
import { toast } from 'sonner';

interface PurchaseOrderItemsTableProps {
  purchaseOrderId: string;
  items: PurchaseOrderItem[];
  isDraft: boolean;
}

export function PurchaseOrderItemsTable({
  purchaseOrderId,
  items,
  isDraft,
}: PurchaseOrderItemsTableProps) {
  const [itemToDelete, setItemToDelete] = useState<PurchaseOrderItem | null>(null);
  const queryClient = useQueryClient();

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => purchaseOrdersApi.removeItem(purchaseOrderId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setItemToDelete(null);
      toast.success('Đã xóa sản phẩm khỏi đơn đặt hàng');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi xóa sản phẩm');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">SL đặt</TableHead>
            <TableHead className="text-right">SL nhận</TableHead>
            <TableHead className="text-right">SL trả</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            {isDraft && <TableHead className="text-right">Thao tác</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items && items.length > 0 ? (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{item.product_name}</div>
                    {item.variant_name && (
                      <div className="text-sm text-muted-foreground">{item.variant_name}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.product_sku || '-'}
                </TableCell>
                <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                <TableCell className="text-right">{item.quantity_received}</TableCell>
                <TableCell className="text-right">{item.quantity_returned}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Number(item.unit_cost))}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(item.total_cost))}
                </TableCell>
                {isDraft && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // TODO: Implement edit functionality
                          toast.info('Chức năng chỉnh sửa đang được phát triển');
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setItemToDelete(item)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={isDraft ? 8 : 7} className="text-center">
                Chưa có sản phẩm nào
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa sản phẩm</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa sản phẩm "{itemToDelete?.product_name}" khỏi đơn đặt
              hàng này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  deleteItemMutation.mutate(itemToDelete.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
