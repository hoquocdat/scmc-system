import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bike, Pencil } from 'lucide-react';
import type { Motorcycle } from '@/types';
import { EditBikeSheet } from './EditBikeSheet';

interface BikeInfoTabProps {
  bike: Motorcycle;
  onBikeUpdate?: () => void;
}

export function BikeInfoTab({ bike, onBikeUpdate }: BikeInfoTabProps) {
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  const handleEditSuccess = () => {
    onBikeUpdate?.();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5" />
              Thông Tin Xe
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditSheetOpen(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Sửa
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Hãng & Mẫu Xe</p>
            <p className="text-lg font-semibold">
              {bike.brand} {bike.model}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Biển Số</p>
            <p className="text-lg font-mono font-semibold">{bike.license_plate}</p>
          </div>

          {bike.year && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Năm Sản Xuất</p>
              <p className="text-lg">{bike.year}</p>
            </div>
          )}

          {bike.color && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Màu Sắc</p>
              <p className="text-lg">{bike.color}</p>
            </div>
          )}
        </div>

        {(bike.vin || bike.engine_number) && (
          <div className="pt-4 border-t space-y-4">
            {bike.vin && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Số Khung (VIN)</p>
                <p className="text-sm font-mono">{bike.vin}</p>
              </div>
            )}

            {bike.engine_number && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Số Máy</p>
                <p className="text-sm font-mono">{bike.engine_number}</p>
              </div>
            )}
          </div>
        )}

        {bike.notes && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Ghi Chú</p>
            <p className="text-sm">{bike.notes}</p>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Đăng ký: {new Date(bike.created_at).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </CardContent>
    </Card>

      <EditBikeSheet
        isOpen={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        bike={bike}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
