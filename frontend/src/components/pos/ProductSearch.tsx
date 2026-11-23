import { forwardRef, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { productsApi, type Product, type ProductVariant } from '@/lib/api/products';
import { formatCurrency } from '@/lib/utils';
import { branchStock, displayPrice } from '@/hooks/usePosCarts';

interface ProductSearchProps {
  locationId: string;
  onAdd: (product: Product, variant: ProductVariant | null, stock: number | null) => void;
}

/**
 * Search by name or SKU, or scan: scanners type the code and press Enter.
 * An exact SKU match adds one unit directly; scanning again increases the quantity.
 */
export const ProductSearch = forwardRef<HTMLInputElement, ProductSearchProps>(function ProductSearch({ locationId, onAdd }, ref) {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['pos', 'products', locationId, query],
    queryFn: () => productsApi.getAll({ search: query || undefined, is_active: true, limit: 48 }),
    placeholderData: keepPreviousData,
  });
  const products = useMemo(() => data?.data ?? [], [data]);

  const addProduct = (product: Product, variant: ProductVariant | null = null) => {
    onAdd(product, variant, branchStock(product, locationId));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = query.trim().toLowerCase();
    if (!code) return;
    for (const p of products) {
      if (p.sku?.toLowerCase() === code) {
        addProduct(p);
        setQuery('');
        return;
      }
      const variant = p.product_variants?.find((v) => v.sku?.toLowerCase() === code);
      if (variant) {
        addProduct(p, variant);
        setQuery('');
        return;
      }
    }
    if (products.length === 1 && !(products[0].product_variants?.length)) {
      addProduct(products[0]);
      setQuery('');
      return;
    }
    toast.error(`Không tìm thấy mã "${query.trim()}"`);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          placeholder="Tìm theo tên, SKU hoặc quét mã… (F2)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-12 pl-10 text-lg"
          autoFocus
          autoComplete="off"
        />
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
        {isLoading && products.length === 0 && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-36" />)}
        {!isLoading && products.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Không tìm thấy sản phẩm</div>
        )}
        {products.map((product) => {
          const stock = branchStock(product, locationId);
          const variants = product.product_variants?.filter((v) => v.is_active !== false) ?? [];
          const card = (
            <Card key={product.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={variants.length ? undefined : () => addProduct(product)}>
              <CardContent className="p-3">
                <div className="mb-2 flex aspect-[4/3] items-center justify-center rounded-md bg-muted">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="line-clamp-2 text-sm font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground">{product.sku}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold">{formatCurrency(displayPrice(product))}</span>
                  {stock !== null && (
                    <Badge variant={stock <= 0 ? 'destructive' : 'secondary'} className="px-1.5">Tồn {stock}</Badge>
                  )}
                </div>
                {variants.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{variants.length} biến thể</div>}
              </CardContent>
            </Card>
          );
          if (variants.length === 0) return card;
          return (
            <Popover key={product.id}>
              <PopoverTrigger asChild>{card}</PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">Chọn biến thể</div>
                <div className="grid gap-1">
                  {variants.map((v) => (
                    <Button key={v.id} variant="ghost" className="justify-between" onClick={() => addProduct(product, v)}>
                      <span className="truncate">{v.name}</span>
                      <span className="text-xs tabular-nums">{formatCurrency(displayPrice(product, v))}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
});
