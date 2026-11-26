import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { brandsApi } from '@/lib/api/brands';
import { priceBookError, priceBooksApi, type EntryRule } from '@/lib/api/price-books';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { productsApi } from '@/lib/api/products';
import { formatCurrency } from '@/lib/utils';
import { EntryRuleFields } from './EntryRuleFields';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
}

type Scope = 'products' | 'category' | 'brand';

/** Add selected products, a whole category or a brand to a book with one rule. */
export function AddEntriesSheet({ open, onOpenChange, bookId }: Props) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>('products');
  const [rule, setRule] = useState<EntryRule>({ mode: 'percent_off', value: 10 });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string>();
  const [brandId, setBrandId] = useState<string>();
  useEffect(() => { if (open) { setSelected([]); setSearch(''); setCategoryId(undefined); setBrandId(undefined); } }, [open]);

  const { data: products } = useQuery({
    queryKey: ['products', 'price-book-picker', search],
    queryFn: () => productsApi.getAll({ search: search || undefined, is_active: true, limit: 30 }),
    enabled: open && scope === 'products',
    placeholderData: keepPreviousData,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['product-categories'], queryFn: productCategoriesApi.getAll, enabled: open && scope === 'category' });
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.getAll, enabled: open && scope === 'brand' });

  const add = useMutation({
    mutationFn: () =>
      priceBooksApi.bulkAdd(bookId, {
        ...rule,
        product_ids: scope === 'products' ? selected : undefined,
        category_id: scope === 'category' ? categoryId : undefined,
        brand_id: scope === 'brand' ? brandId : undefined,
      }),
    onSuccess: (r) => {
      toast.success(`Đã thêm ${r.created} mặt hàng${r.skipped ? `, bỏ qua ${r.skipped} đã có trong bảng giá` : ''}`);
      void queryClient.invalidateQueries({ queryKey: ['price-books'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(priceBookError(e).message),
  });

  const ready = scope === 'products' ? selected.length > 0 : scope === 'category' ? !!categoryId : !!brandId;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>Thêm mặt hàng vào bảng giá</SheetTitle>
          <SheetDescription>Áp dụng cho sản phẩm và mọi biến thể. Mặt hàng đã có trong bảng giá giữ nguyên cách tính cũ.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2"><Label>Cách tính</Label><EntryRuleFields value={rule} onChange={setRule} /></div>
          <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <TabsList>
              <TabsTrigger value="products">Chọn sản phẩm</TabsTrigger>
              <TabsTrigger value="category">Theo danh mục</TabsTrigger>
              <TabsTrigger value="brand">Theo thương hiệu</TabsTrigger>
            </TabsList>
            <TabsContent value="products" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Tìm sản phẩm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="max-h-96 space-y-1 overflow-y-auto rounded-md border p-2">
                {products?.data.map((p) => (
                  <Label key={p.id} className="flex items-center justify-between gap-2 rounded-md p-2 font-normal hover:bg-muted">
                    <span className="flex items-center gap-2"><Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />{p.name} <span className="font-mono text-xs text-muted-foreground">{p.sku}</span></span>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(Number(p.retail_price))}</span>
                  </Label>
                ))}
                {products?.data.length === 0 && <p className="p-2 text-sm text-muted-foreground">Không tìm thấy sản phẩm</p>}
              </div>
              <p className="text-sm text-muted-foreground">Đã chọn {selected.length} sản phẩm</p>
            </TabsContent>
            <TabsContent value="category">
              <Select value={categoryId ?? ''} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </TabsContent>
            <TabsContent value="brand">
              <Select value={brandId ?? ''} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue placeholder="Chọn thương hiệu" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </TabsContent>
          </Tabs>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!ready || add.isPending} onClick={() => add.mutate()}>Thêm vào bảng giá</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
