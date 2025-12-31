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
import { type SalesChannel, SALES_CHANNEL_LABELS } from '@/lib/api/sales';

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
  customerEmail: string;
  onCustomerNameChange: (name: string) => void;
  onCustomerPhoneChange: (phone: string) => void;
  onCustomerEmailChange: (email: string) => void;
  selectedChannel: SalesChannel;
  onChannelChange: (channel: SalesChannel) => void;
  isLoading?: boolean;
}

export function CustomerSelectCard({
  customers,
  selectedCustomerId,
  onCustomerChange,
  customerName,
  customerPhone,
  customerEmail,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerEmailChange,
  selectedChannel,
  onChannelChange,
  isLoading,
}: CustomerSelectCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Kênh bán hàng *</Label>
          <Select value={selectedChannel} onValueChange={(v) => onChannelChange(v as SalesChannel)}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn kênh bán hàng" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SALES_CHANNEL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Khách hàng</Label>
          <Select
            value={selectedCustomerId || 'walk-in'}
            onValueChange={(value) => onCustomerChange(value === 'walk-in' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn khách hàng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walk-in">Khách vãng lai</SelectItem>
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
        </div>

        <div className="space-y-2">
          <Label>Tên khách hàng *</Label>
          <Input
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Nhập tên khách hàng"
          />
        </div>

        <div className="space-y-2">
          <Label>Số điện thoại</Label>
          <Input
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="Nhập số điện thoại"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => onCustomerEmailChange(e.target.value)}
            placeholder="Nhập email"
          />
        </div>
      </div>
    </Card>
  );
}
