import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MapPin, FileText, User, Facebook, Instagram } from 'lucide-react';
import type { Customer } from '../../types';

interface CustomerInfoTabProps {
  customer: Customer;
}

export function CustomerInfoTab({ customer }: CustomerInfoTabProps) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <User className="h-4 w-4 sm:h-5 sm:w-5" />
          Thông Tin Liên Hệ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <div className="flex items-start gap-2 sm:gap-3">
            <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Số Điện Thoại</p>
              <p className="text-base sm:text-lg truncate">{customer.phone}</p>
            </div>
          </div>

          {customer.email && (
            <div className="flex items-start gap-2 sm:gap-3">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-base sm:text-lg truncate">{customer.email}</p>
              </div>
            </div>
          )}

          {customer.id_number && (
            <div className="flex items-start gap-2 sm:gap-3">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Số CMND/CCCD</p>
                <p className="text-base sm:text-lg font-mono truncate">{customer.id_number}</p>
              </div>
            </div>
          )}

          {customer.facebook && (
            <div className="flex items-start gap-2 sm:gap-3">
              <Facebook className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Facebook</p>
                <p className="text-base sm:text-lg truncate">{customer.facebook}</p>
              </div>
            </div>
          )}

          {customer.instagram && (
            <div className="flex items-start gap-2 sm:gap-3">
              <Instagram className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Instagram</p>
                <p className="text-base sm:text-lg truncate">{customer.instagram}</p>
              </div>
            </div>
          )}

          {customer.address && (
            <div className="flex items-start gap-2 sm:gap-3 col-span-1 sm:col-span-2">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Địa Chỉ</p>
                <p className="text-sm sm:text-base md:text-lg break-words">{customer.address}</p>
              </div>
            </div>
          )}
        </div>

        {customer.notes && (
          <div className="pt-3 sm:pt-4 border-t">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Ghi Chú</p>
            <p className="text-xs sm:text-sm break-words">{customer.notes}</p>
          </div>
        )}

        <div className="pt-3 sm:pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Khách hàng từ: {new Date(customer.created_at).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
