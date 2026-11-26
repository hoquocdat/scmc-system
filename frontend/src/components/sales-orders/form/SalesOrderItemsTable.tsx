import { LineUnitSelect } from '@/components/stock/LineUnitSelect';
import type { ProductUnit } from '@/lib/api/stock-operations';
import { Badge } from '@/components/ui/badge';
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

export interface SalesOrderItem {
  tempId: string;
  product_id: string;
  product_variant_id?: string;
  product_name: string;
  product_sku?: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  /** Price book that priced the line (server quote); null = base price. */
  price_book_name?: string | null;
  /** Selling unit (product_units); absent = base unit. */
  unit_id?: string | null;
}

interface SalesOrderItemsTableProps {
  items: SalesOrderItem[];
  onRemoveItem: (tempId: string) => void;
  onUpdateQuantity: (tempId: string, quantity: number) => void;
  onUnit?: (tempId: string, unit: ProductUnit | null) => void;
}

export function SalesOrderItemsTable({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onUnit,
}: SalesOrderItemsTableProps) {
  return (
    <Card className="p-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">STT</TableHead>
            <TableHead>Mã hàng</TableHead>
            <TableHead>Tên hàng</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Chưa có sản phẩm nào. Tìm kiếm sản phẩm ở trên để thêm vào đơn hàng.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => {
              const total = item.quantity * item.unit_price;
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
                      {onUnit && !item.product_variant_id && (
                        <div className="mt-1"><LineUnitSelect productId={item.product_id} value={item.unit_id} onChange={(u) => onUnit(item.tempId, u)} /></div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateQuantity(item.tempId, parseInt(e.target.value) || 1)
                      }
                      className="w-20 text-right"
                      min="1"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="tabular-nums">{item.unit_price.toLocaleString('vi-VN')}</div>
                    {item.price_book_name && (
                      <Badge variant="secondary" className="mt-1 px-1.5 text-[11px]">{item.price_book_name}</Badge>
                    )}
                  </TableCell>
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
