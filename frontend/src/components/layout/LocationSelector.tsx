import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { stockLocationsApi } from '@/lib/api/stock-locations';
import { useLocationStore } from '@/store/locationStore';
import { useEffect } from 'react';

export function LocationSelector() {
  const { selectedLocationId, selectedLocationName, setLocation } = useLocationStore();

  // Fetch all locations
  const { data: locations = [], isLoading, isSuccess } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => stockLocationsApi.getAll(),
  });

  const activeLocations = locations.filter((loc) => loc.is_active);

  // Auto-select default location if none selected
  useEffect(() => {
    if (isSuccess && !selectedLocationId && activeLocations.length > 0) {
      // Find default location or use first active one
      const defaultLocation = activeLocations.find((loc) => loc.is_default);
      const locationToSelect = defaultLocation || activeLocations[0];

      if (locationToSelect) {
        setLocation(locationToSelect.id, locationToSelect.name);
      }
    }
  }, [isSuccess, selectedLocationId, activeLocations, setLocation]);

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <MapPin className="h-4 w-4" />
        <span className="hidden sm:inline">Đang tải...</span>
      </Button>
    );
  }

  if (activeLocations.length === 0) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <MapPin className="h-4 w-4" />
        <span className="hidden sm:inline text-destructive">Chưa có chi nhánh</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <MapPin className="h-4 w-4" />
          <span className="hidden sm:inline max-w-[120px] truncate">
            {selectedLocationName || 'Chọn chi nhánh'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Chi nhánh làm việc</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeLocations.map((location) => (
          <DropdownMenuItem
            key={location.id}
            onClick={() => setLocation(location.id, location.name)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span>{location.name}</span>
              {location.code && (
                <span className="text-xs text-muted-foreground">{location.code}</span>
              )}
            </div>
            {selectedLocationId === location.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
