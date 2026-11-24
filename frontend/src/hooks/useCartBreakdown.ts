import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { promotionsApi, type CartRequest } from '@/lib/api/promotions';

/** The server's full discount breakdown of a cart (promotions-vouchers D8); null request = nothing to price. */
export function useCartBreakdown(request: CartRequest | null) {
  return useQuery({
    queryKey: ['pricing', 'cart', request],
    queryFn: () => promotionsApi.cart(request!),
    enabled: !!request && request.lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}
