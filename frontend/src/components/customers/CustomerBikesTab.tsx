import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bike, Plus } from 'lucide-react';
import type { Motorcycle } from '../../types';

interface CustomerBikesTabProps {
  bikes: Motorcycle[];
  onAddBike: () => void;
}

export function CustomerBikesTab({ bikes, onAddBike }: CustomerBikesTabProps) {
  const navigate = useNavigate();

  return (

    <div className="p-4 sm:p-6">
      {bikes.length === 0 ? (
        <div className='flex flex-1 flex-col justify-between items-center'>
          <div className=''>
            <p className="text-sm text-muted-foreground text-center py-8">
              Chưa có xe nào được đăng ký cho khách hàng này
            </p>
          </div>
          <Button onClick={onAddBike} size="lg">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Tạo xe</span>
            <span className="sm:hidden">Tạo xe</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Add Bike Button at the top */}
          <div className="flex justify-end">
            <Button onClick={onAddBike} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Thêm xe mới
            </Button>
          </div>

          {/* Vertical Bike Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {bikes.map((bike) => {
              // Use image_url which already contains the primary image or first available
              const bikeImage = bike.image_url;

              return (
                <div
                  key={bike.id}
                  className="flex flex-col border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => navigate(`/bikes/${bike.id}`)}
                >
                  {/* Bike Image */}
                  <div className="w-full aspect-square bg-gray-100 relative overflow-hidden">
                    {bikeImage ? (
                      <img
                        src={bikeImage}
                        alt={`${bike.brand} ${bike.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Bike className="h-12 w-12 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Bike Info */}
                  <div className="p-3 flex flex-col gap-2">
                    <div className="font-semibold text-sm line-clamp-2">
                      {bike.brand} {bike.model}
                    </div>
                    <Badge variant="outline" className="font-mono text-xs w-fit">
                      {bike.license_plate}
                    </Badge>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {bike.year && <span>{bike.year}</span>}
                      {bike.year && bike.color && <span>•</span>}
                      {bike.color && <span className="truncate">{bike.color}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
