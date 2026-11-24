import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { priceBooksApi, quoteKey, type QuoteItem } from '@/lib/api/price-books';

interface QuotableItem extends QuoteItem {
  unit_price: number;
}

/**
 * Applies server prices (base price + price books) to order lines for display.
 * The server prices the order again when it is saved; this only shows the
 * same numbers beforehand (price-books D5).
 */
export function useQuotedItems<T extends QuotableItem>(
  storeId: string | null | undefined,
  customerId: string | null | undefined,
  priceBookId: string | null | undefined,
  items: T[],
) {
  const keys = items.map((i) => quoteKey(i)).sort().join(',');
  const quote = useQuery({
    queryKey: ['pricing', 'quote', storeId, customerId ?? null, priceBookId ?? null, keys],
    queryFn: () =>
      priceBooksApi.quote({
        store_id: storeId!,
        customer_id: customerId,
        price_book_id: priceBookId,
        items: items.map((i) => ({ product_id: i.product_id, product_variant_id: i.product_variant_id })),
      }),
    enabled: !!storeId && items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const priced = useMemo(() => {
    const byKey = new Map(quote.data?.items.map((q) => [quoteKey(q), q]));
    return items.map((i) => {
      const q = byKey.get(quoteKey(i));
      return q ? { ...i, unit_price: q.unit_price, base_price: q.base_price, price_book_name: q.price_book_name } : { ...i, price_book_name: null as string | null };
    });
  }, [items, quote.data]);

  return { items: priced, isFetching: quote.isFetching, error: quote.error };
}
