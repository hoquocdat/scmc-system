import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface PurchaseOrderItem {
  tempId: string;
  product_id: string;
  product_variant_id?: string;
  product_name: string;
  product_sku?: string;
  variant_name?: string;
  quantity_ordered: number;
  unit_cost: number;
  notes?: string;
}

interface PurchaseOrderItemsTableProps {
  items: PurchaseOrderItem[];
  onRemoveItem: (tempId: string) => void;
  onUpdateQuantity: (tempId: string, quantity: number) => void;
  onUpdateUnitCost: (tempId: string, cost: number) => void;
}

export function PurchaseOrderItemsTable({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateUnitCost,
}: PurchaseOrderItemsTableProps) {
  return (
    <Card className="p-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">STT</TableHead>
            <TableHead>Mã hàng</TableHead>
            <TableHead>Tên hàng</TableHead>
            <TableHead>ĐVT</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Giảm giá</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => {
              const total = item.quantity_ordered * item.unit_cost;
              return (
                <TableRow key={item.tempId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.product_sku || '-'}</TableCell>
                  <TableCell>
                    <div>
                      <div>{item.product_name}</div>
                      {item.variant_name && (
                        <div className="text-sm text-muted-foreground">
                          {item.variant_name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={item.quantity_ordered}
                      onChange={(e) =>
                        onUpdateQuantity(item.tempId, parseInt(e.target.value) || 1)
                      }
                      className="w-20 text-right"
                      min="1"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) =>
                        onUpdateUnitCost(item.tempId, parseFloat(e.target.value) || 0)
                      }
                      className="w-28 text-right"
                      min="0"
                    />
                  </TableCell>
                  <TableCell className="text-right">0</TableCell>
                  <TableCell className="text-right font-medium">
                    {total.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(item.tempId)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
