import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Supplier {
  id: string;
  name: string;
}

interface SupplierSelectCardProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierChange: (supplierId: string) => void;
  status?: string;
}

export function SupplierSelectCard({
  suppliers,
  selectedSupplierId,
  onSupplierChange,
  status = 'Phiếu tạm',
}: SupplierSelectCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nhà cung cấp *</Label>
          <Select value={selectedSupplierId} onValueChange={onSupplierChange}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn nhà cung cấp" />
            </SelectTrigger>
            <SelectContent>
              {suppliers && suppliers.length > 0 ? (
                suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  Không có nhà cung cấp
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Trạng thái</Label>
          <Input value={status} disabled />
        </div>
      </div>
    </Card>
  );
}
