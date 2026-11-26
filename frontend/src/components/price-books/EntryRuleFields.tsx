import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODE_LABELS, type EntryRule, type PriceBookMode } from '@/lib/api/price-books';

interface EntryRuleFieldsProps {
  value: EntryRule;
  onChange: (rule: EntryRule) => void;
  compact?: boolean;
}

/** Mode select plus a money or percent input. */
export function EntryRuleFields({ value, onChange, compact }: EntryRuleFieldsProps) {
  return (
    <div className="flex gap-2">
      <Select value={value.mode} onValueChange={(m) => onChange({ mode: m as PriceBookMode, value: value.value })}>
        <SelectTrigger className={compact ? 'h-8 w-32' : 'w-40'} aria-label="Cách tính"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(MODE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      {value.mode === 'percent_off' ? (
        <Input
          type="number"
          min={0}
          max={100}
          step="0.5"
          aria-label="Phần trăm giảm"
          className={compact ? 'h-8 w-24' : 'w-28'}
          value={Number.isFinite(value.value) ? value.value : ''}
          onChange={(e) => onChange({ mode: value.mode, value: Number(e.target.value) })}
        />
      ) : (
        <CurrencyInput aria-label="Số tiền" className={compact ? 'h-8 w-36' : 'w-44'} value={value.value} onValueChange={(v) => onChange({ mode: value.mode, value: v ?? 0 })} />
      )}
    </div>
  );
}
