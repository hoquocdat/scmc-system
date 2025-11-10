import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User, Phone, Mail, MapPin, FileText } from 'lucide-react';

interface Owner {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  id_number?: string;
  notes?: string;
}

interface OwnerCardProps {
  owner: Owner;
  showFullProfileButton?: boolean;
}

export function OwnerCard({ owner, showFullProfileButton = true }: OwnerCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg"
      onClick={() => navigate(`/customers/${owner.id}`)}
    >
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg sm:text-xl mb-1 truncate">{owner.full_name}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Chủ Sở Hữu</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-2 sm:gap-3">
            <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Số Điện Thoại</p>
              <p className="text-sm sm:text-base truncate">{owner.phone}</p>
            </div>
          </div>

          {owner.email && (
            <div className="flex items-start gap-2 sm:gap-3">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm sm:text-base truncate">{owner.email}</p>
              </div>
            </div>
          )}

          {owner.id_number && (
            <div className="flex items-start gap-2 sm:gap-3">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Số CMND/CCCD</p>
                <p className="text-sm sm:text-base font-mono truncate">{owner.id_number}</p>
              </div>
            </div>
          )}

          {owner.address && (
            <div className="flex items-start gap-2 sm:gap-3 sm:col-span-2">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Địa Chỉ</p>
                <p className="text-sm sm:text-base">{owner.address}</p>
              </div>
            </div>
          )}
        </div>

        {owner.notes && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Ghi Chú</p>
            <p className="text-sm">{owner.notes}</p>
          </div>
        )}

        {showFullProfileButton && (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" size="sm">
              Xem Hồ Sơ Đầy Đủ →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
