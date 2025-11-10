import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ServiceItem, ServiceStatus } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useEntityImages } from '@/hooks/useImages';
import { apiClient } from '@/lib/api-client';
import {
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  ImageIcon
} from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import Download from 'yet-another-react-lightbox/plugins/download';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

interface ServiceItemCardProps {
  item: ServiceItem;
  onEdit: (item: ServiceItem) => void;
  onDelete: (id: string) => void;
  getStatusColor: (status: ServiceStatus) => string;
  getStatusLabel: (status: ServiceStatus) => string;
}

const getStatusIcon = (status: ServiceStatus) => {
  const iconMap: Record<ServiceStatus, any> = {
    pending: HelpCircle,
    confirmed: CheckCircle2,
    in_progress: Loader2,
    waiting_parts: AlertCircle,
    waiting_approval: AlertCircle,
    quality_check: CheckCircle2,
    completed: CheckCircle2,
    ready_for_pickup: CheckCircle2,
    delivered: CheckCircle2,
    cancelled: AlertCircle,
  };
  return iconMap[status] || HelpCircle;
};

export function ServiceItemCard({
  item,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusLabel,
}: ServiceItemCardProps) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  // Fetch images for this service item
  const { data: imageRecords } = useEntityImages('service_item', item.id);

  // Fetch assigned employee if exists
  const { data: assignedEmployee } = useQuery({
    queryKey: ['employee', item.assigned_employee_id],
    queryFn: async () => {
      if (!item.assigned_employee_id) return null;
      return await apiClient.users.getOne(item.assigned_employee_id);
    },
    enabled: !!item.assigned_employee_id,
  });

  // Extract image URLs
  const images = useMemo(() => {
    if (imageRecords && imageRecords.length > 0) {
      const sorted = [...imageRecords].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return sorted.map(img => img.public_url);
    }
    return [];
  }, [imageRecords]);

  const StatusIcon = getStatusIcon(item.status);
  const statusColorClass = getStatusColor(item.status).replace('bg-', 'text-');

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon className={`h-5 w-5 ${statusColorClass} flex-shrink-0`} />
              <h4 className="font-semibold text-lg truncate">{item.name}</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {getStatusLabel(item.status)}
              </Badge>
              {images.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {images.length}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(item)}
              className="h-9 w-9"
              title="Edit task"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(item.id)}
              className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Assigned Employee */}
          {item.assigned_employee_id && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Assigned to</p>
                <p className="font-medium truncate">
                  {assignedEmployee ? (assignedEmployee as any).full_name : 'Loading...'}
                </p>
              </div>
            </div>
          )}

          {/* Hours Worked */}
          {Number(item.hours_worked) > 0 && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Hours</p>
                <p className="font-medium">{Number(item.hours_worked).toFixed(1)}h</p>
              </div>
            </div>
          )}

          {/* Labor Cost */}
          {Number(item.labor_cost) > 0 && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
              <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Labor</p>
                <p className="font-medium">${Number(item.labor_cost).toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Image Gallery - Responsive Grid */}
        {images.length > 0 && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((imageUrl, index) => (
                <div
                  key={imageUrl}
                  className="relative aspect-square rounded-lg border overflow-hidden cursor-pointer group hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => setLightboxIndex(index)}
                >
                  <img
                    src={imageUrl}
                    alt={`${item.name} image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Lightbox for viewing images */}
      {images.length > 0 && (
        <Lightbox
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
          index={lightboxIndex}
          slides={images.map((src) => ({ src }))}
          plugins={[Download, Zoom]}
          zoom={{
            maxZoomPixelRatio: 3,
            scrollToZoom: true,
          }}
        />
      )}
    </Card>
  );
}
