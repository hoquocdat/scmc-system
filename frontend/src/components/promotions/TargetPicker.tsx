import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductSearchInput } from '@/components/inventory/purchase-orders/ProductSearchInput';
import { brandsApi } from '@/lib/api/brands';
import { productCategoriesApi } from '@/lib/api/product-categories';
import { TARGET_TYPE_LABELS, type PromotionTarget, type TargetRole } from '@/lib/api/promotions';

interface Props {
  role: TargetRole;
  targets: PromotionTarget[];
  names: Record<string, string>;
  onChange: (targets: PromotionTarget[], names: Record<string, string>) => void;
  /** Bundle components: products/variants only, with a quantity each. */
  bundle?: boolean;
}

/** Chooses the products, variants, categories or brands a promotion rule applies to. */
export function TargetPicker({ role, targets, names, onChange, bundle }: Props) {
  const [tab, setTab] = useState('product');
  const mine = targets.filter((t) => t.role === role);
  const others = targets.filter((t) => t.role !== role);
  const { data: categories = [] } = useQuery({ queryKey: ['product-categories'], queryFn: productCategoriesApi.getAll, enabled: !bundle && tab === 'category' });
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.getAll, enabled: !bundle && tab === 'brand' });

  const add = (t: Omit<PromotionTarget, 'role'>, name: string) => {
    if (mine.some((m) => m.target_type === t.target_type && m.target_id === t.target_id)) return;
    onChange([...others, ...mine, { ...t, role, quantity: t.quantity ?? 1 }], { ...names, [t.target_id]: name });
  };
  const remove = (t: PromotionTarget) => onChange([...others, ...mine.filter((m) => m !== t)], names);
  const setQty = (t: PromotionTarget, quantity: number) => onChange([...others, ...mine.map((m) => (m === t ? { ...m, quantity } : m))], names);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {mine.map((t) => (
          <Badge key={`${t.target_type}:${t.target_id}`} variant="secondary" className="gap-1 pr-1">
            <span className="text-muted-foreground">{TARGET_TYPE_LABELS[t.target_type]}:</span> {names[t.target_id] ?? t.target_id.slice(0, 8)}
            {bundle && (
              <Input type="number" min={1} aria-label="Số lượng trong combo" className="ml-1 h-6 w-14 px-1" value={t.quantity ?? 1} onChange={(e) => setQty(t, Math.max(1, Number(e.target.value) || 1))} />
            )}
            <button type="button" aria-label="Bỏ" className="rounded-full p-0.5 hover:bg-muted-foreground/20" onClick={() => remove(t)}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        {mine.length === 0 && <span className="text-sm text-muted-foreground">Chưa chọn</span>}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        {!bundle && (
          <TabsList>
            <TabsTrigger value="product">Sản phẩm</TabsTrigger>
            <TabsTrigger value="category">Danh mục</TabsTrigger>
            <TabsTrigger value="brand">Thương hiệu</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="product">
          <ProductSearchInput
            placeholder="Tìm sản phẩm để thêm…"
            onProductSelect={(p, v) =>
              v
                ? add({ target_type: 'variant', target_id: v.id }, `${p.name} / ${v.name}`)
                : add({ target_type: 'product', target_id: p.id }, p.name)
            }
          />
        </TabsContent>
        <TabsContent value="category">
          <Select value="" onValueChange={(id) => add({ target_type: 'category', target_id: id }, categories.find((c) => c.id === id)?.name ?? id)}>
            <SelectTrigger><SelectValue placeholder="Thêm danh mục" /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </TabsContent>
        <TabsContent value="brand">
          <Select value="" onValueChange={(id) => add({ target_type: 'brand', target_id: id }, brands.find((b) => b.id === id)?.name ?? id)}>
            <SelectTrigger><SelectValue placeholder="Thêm thương hiệu" /></SelectTrigger>
            <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </TabsContent>
      </Tabs>
    </div>
  );
}
