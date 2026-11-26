import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Cart } from '@/hooks/usePosCarts';

interface CartTabsProps {
  carts: Cart[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
}

/** Several open invoices at once; closing a tab discards that cart without recording a sale. */
export function CartTabs({ carts, activeId, onSwitch, onNew, onClose }: CartTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <Tabs value={activeId} onValueChange={onSwitch} className="min-w-0">
        <TabsList className="h-9">
          {carts.map((cart, i) => (
            <TabsTrigger key={cart.id} value={cart.id} className="gap-2 pr-1">
              <span className="text-xs text-muted-foreground">{i + 1}</span>
              {cart.customer?.full_name ?? cart.new_customer?.name ?? cart.label}
              {cart.lines.length > 0 && <Badge variant="secondary" className="px-1.5">{cart.lines.reduce((s, l) => s + l.quantity, 0)}</Badge>}
              <span
                role="button"
                aria-label={`Đóng ${cart.label}`}
                className="rounded p-0.5 hover:bg-muted-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  if (cart.lines.length === 0 || window.confirm('Đóng đơn này? Giỏ hàng sẽ bị bỏ.')) onClose(cart.id);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button variant="outline" size="sm" onClick={onNew} title="Đơn mới (Ctrl+T)">
        <Plus className="h-4 w-4" /> Đơn mới
      </Button>
    </div>
  );
}
