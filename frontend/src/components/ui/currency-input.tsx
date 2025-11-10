import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number;
  onValueChange?: (value: number | undefined) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');

    // Format number to display with thousand separators
    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('vi-VN').format(num);
    };

    // Parse formatted string back to number
    const parseNumber = (str: string): number | undefined => {
      const cleaned = str.replace(/\./g, '').replace(/[^\d]/g, '');
      if (cleaned === '') return undefined;
      const num = parseInt(cleaned, 10);
      return isNaN(num) ? undefined : num;
    };

    // Update display value when prop value changes
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        setDisplayValue(formatNumber(value));
      } else {
        setDisplayValue('');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty input
      if (inputValue === '') {
        setDisplayValue('');
        onValueChange?.(undefined);
        return;
      }

      // Parse and format
      const numValue = parseNumber(inputValue);
      if (numValue !== undefined) {
        setDisplayValue(formatNumber(numValue));
        onValueChange?.(numValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ensure proper formatting on blur
      const numValue = parseNumber(e.target.value);
      if (numValue !== undefined) {
        setDisplayValue(formatNumber(numValue));
      } else {
        setDisplayValue('');
      }
      props.onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
