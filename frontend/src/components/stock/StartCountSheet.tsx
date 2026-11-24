import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { brandsApi } from '@/lib/api/brands';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { stockError, stockOpsApi, type StockCount } from '@/lib/api/stock-operations';
import { LocationSelect } from './LocationSelect';
import { StockLinesEditor, type EditorLine } from './StockLinesEditor';

type ScopeType = 'all' | 'category' | 'brand' | 'products';

/** Starts a count of a location: everything, a category, a brand or chosen products. */
export function StartCountSheet({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (o: boolean) => void; onStarted: (c: StockCount) => void }) {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<string>();
  const [type, setType] = useState<ScopeType>('category');
  const [category, setCategory] = useState<string>();
  const [brand, setBrand] = useState<string>();
  const [products, setProducts] = useState<EditorLine[]>([]);
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setProducts([]); setNote(''); } }, [open]);
  const { data: categories = [] } = useQuery({ queryKey: ['product-categories'], queryFn: productCategoriesApi.getAll, enabled: open && type === 'category' });
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.getAll, enabled: open && type === 'brand' });
  const ready = !!location && (type === 'all' || (type === 'category' && !!category) || (type === 'brand' && !!brand) || (type === 'products' && products.length > 0));
  const start = useMutation({
    mutationFn: () => stockOpsApi.startCount({ location_id: location!, note: note || undefined, scope: { type, category_id: category, brand_id: brand, product_ids: [...new Set(products.map((p) => p.key.split(':')[0]))] } }),
    onSuccess: (c) => { toast.success(`Đã tạo ${c.count_number}`); void queryClient.invalidateQueries({ queryKey: ['stock-counts'] }); onOpenChange(false); onStarted(c); },
    onError: (e) => toast.error(stockError(e)),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="px-6">
          <SheetTitle>Tạo phiếu kiểm kho</SheetTitle>
          <SheetDescription>Mỗi kho có một phiếu kiểm đang mở. Bán hàng vẫn tiếp tục trong lúc kiểm: chênh lệch tính theo tồn hệ thống tại lúc đếm từng mặt hàng.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2"><Label>Kho</Label><LocationSelect value={location} onChange={setLocation} /></div>
          <div className="space-y-2">
            <Label>Phạm vi</Label>
            <Select value={type} onValueChange={(v) => setType(v as ScopeType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="category">Một danh mục</SelectItem><SelectItem value="brand">Một thương hiệu</SelectItem><SelectItem value="products">Chọn sản phẩm</SelectItem><SelectItem value="all">Toàn bộ kho</SelectItem></SelectContent>
            </Select>
          </div>
          {type === 'category' && (
            <Select value={category ?? ''} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          )}
          {type === 'brand' && (
            <Select value={brand ?? ''} onValueChange={setBrand}><SelectTrigger><SelectValue placeholder="Chọn thương hiệu" /></SelectTrigger><SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
          )}
          {type === 'products' && <StockLinesEditor lines={products} onChange={setProducts} />}
          <div className="space-y-2"><Label htmlFor="ct-note">Ghi chú</Label><Textarea id="ct-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button disabled={!ready || start.isPending} onClick={() => start.mutate()}>Bắt đầu kiểm</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
