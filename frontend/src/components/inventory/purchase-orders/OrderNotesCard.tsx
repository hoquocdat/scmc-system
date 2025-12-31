import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface OrderNotesCardProps {
  notes: string;
  internalNotes: string;
  onNotesChange: (notes: string) => void;
  onInternalNotesChange: (internalNotes: string) => void;
}

export function OrderNotesCard({
  notes,
  internalNotes,
  onNotesChange,
  onInternalNotesChange,
}: OrderNotesCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Ghi chú</Label>
          <Textarea
            placeholder="Ghi chú cho đơn hàng..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Ghi chú nội bộ</Label>
          <Textarea
            placeholder="Ghi chú nội bộ (không hiển thị cho nhà cung cấp)..."
            value={internalNotes}
            onChange={(e) => onInternalNotesChange(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </Card>
  );
}
