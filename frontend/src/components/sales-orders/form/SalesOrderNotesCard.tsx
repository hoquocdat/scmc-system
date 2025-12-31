import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SalesOrderNotesCardProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function SalesOrderNotesCard({
  notes,
  onNotesChange,
}: SalesOrderNotesCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-2">
        <Label>Ghi chú</Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Ghi chú cho đơn hàng..."
          rows={3}
        />
      </div>
    </Card>
  );
}
