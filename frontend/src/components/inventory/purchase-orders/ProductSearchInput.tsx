import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { productsApi } from '@/lib/api/products';

interface Product {
  id: string;
  name: string;
  sku?: string;
  cost_price?: number;
}

interface ProductVariant {
  id: string;
  name: string;
}

interface ProductSearchInputProps {
  onProductSelect: (product: Product, variant?: ProductVariant) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function ProductSearchInput({
  onProductSelect,
  placeholder = 'Tìm theo mã hàng (F3)',
  debounceMs = 2000,
}: ProductSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  // Fetch products for selection using debounced query
  const { data: productsResponse, isFetching } = useQuery({
    queryKey: ['products', debouncedQuery],
    queryFn: () => productsApi.getAll({ search: debouncedQuery }),
    enabled: debouncedQuery.length > 0,
  });
  const products = productsResponse?.data || [];

  const isDebouncing = searchQuery !== debouncedQuery && searchQuery.length > 0;

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductClick = (product: Product, variant?: ProductVariant) => {
    onProductSelect(product, variant);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const isLoading = isDebouncing || isFetching;

  return (
    <div className="relative" ref={searchRef}>
      {isLoading ? (
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 animate-spin" />
      ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      )}
      <Input
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowSearchResults(true);
        }}
        onFocus={() => setShowSearchResults(true)}
        className="pl-9"
      />

      {/* Search Results Dropdown */}
      {showSearchResults && searchQuery && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-background border rounded-md shadow-lg">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tìm kiếm...
            </div>
          ) : products.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Không tìm thấy sản phẩm
            </div>
          ) : (
            <div className="divide-y">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-3 hover:bg-accent cursor-pointer"
                  onClick={() => handleProductClick(product)}
                >
                  <div className="font-medium text-sm">{product.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {product.sku} | {Number(product.cost_price || 0).toLocaleString('vi-VN')} VND
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
