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

interface Customer {
  id: string;
  full_name: string;
  phone?: string;
}

interface CustomerSelectCardProps {
  customers: Customer[];
  selectedCustomerId: string;
  onCustomerChange: (customerId: string) => void;
  customerName: string;
  customerPhone: string;
  isLoading?: boolean;
}

export function CustomerSelectCard({
  customers,
  selectedCustomerId,
  onCustomerChange,
  customerName,
  customerPhone,
  isLoading,
}: CustomerSelectCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Khách hàng *</Label>
          <Select
            value={selectedCustomerId || ''}
            onValueChange={onCustomerChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn khách hàng" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <SelectItem value="loading" disabled>Đang tải...</SelectItem>
              ) : customers.length > 0 ? (
                customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.full_name} {customer.phone && `(${customer.phone})`}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>Không có khách hàng</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Vui lòng chọn khách hàng hoặc tạo mới nếu chưa có
          </p>
        </div>

        <div className="space-y-2">
          <Label>Tên khách hàng</Label>
          <Input
            value={customerName}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label>Số điện thoại</Label>
          <Input
            value={customerPhone}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>
      </div>
    </Card>
  );
}
