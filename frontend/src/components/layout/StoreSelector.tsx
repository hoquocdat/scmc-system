import { useQuery } from '@tanstack/react-query';
import { Store, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { storesApi } from '@/lib/api/stores';
import { useStoreStore } from '@/store/storeStore';
import { useEffect } from 'react';

export function StoreSelector() {
  const { selectedStoreId, selectedStoreName, setStore } = useStoreStore();

  // Fetch all stores
  const { data: stores = [], isLoading, isSuccess } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.getAll(),
  });

  const activeStores = stores.filter((s) => s.is_active);

  // Auto-select default store if none selected
  useEffect(() => {
    if (isSuccess && !selectedStoreId && activeStores.length > 0) {
      // Find default store or use first active one
      const defaultStore = activeStores.find((s) => s.is_default);
      const storeToSelect = defaultStore || activeStores[0];

      if (storeToSelect) {
        setStore(storeToSelect.id, storeToSelect.name);
      }
    }
  }, [isSuccess, selectedStoreId, activeStores, setStore]);

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Store className="h-4 w-4" />
        <span className="hidden sm:inline">Đang tải...</span>
      </Button>
    );
  }

  if (activeStores.length === 0) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Store className="h-4 w-4" />
        <span className="hidden sm:inline text-destructive">Chưa có cửa hàng</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Store className="h-4 w-4" />
          <span className="hidden sm:inline max-w-[120px] truncate">
            {selectedStoreName || 'Chọn cửa hàng'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Cửa hàng làm việc</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeStores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => setStore(store.id, store.name)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span>{store.name}</span>
              {store.code && (
                <span className="text-xs text-muted-foreground">{store.code}</span>
              )}
            </div>
            {selectedStoreId === store.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
